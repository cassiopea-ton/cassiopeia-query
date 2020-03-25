const { TONClient } = require("ton-client-node-js");

class QueryClient {
  constructor(client) {
    this.client = client;
  }

  async getAccountTransactions(
    addr,
    params = ["id", "now", "status", "in_message { body }"]
  ) {
    return await this.client.queries.transactions.query(
      {
        status: { eq: 3 },
        tr_type: { eq: 0 },
        end_status: { eq: 1 },
        success: { eq: 1 },
        account_addr: {
          eq: addr
        }
      },
      params.join(" ")
    );
  }

  async getAccount(addr, params = ["code", "data"]) {
    return await this.client.queries.accounts.query(
      {
        acc_type: { eq: 1 },
        id: {
          eq: addr
        }
      },
      params.join(" ")
    );
  }
}

// boc: {
//     magic: Int,
//     has_idx: Boolean,
//     has_crc32c: Boolean,
//     has_cache_bits: Boolean,
//     flags: Int,
//     size: Int,
//     off_bytes: Int,
//     cells: Int,
//     roots: Int,
//     absent: Int,
//     tot_cells_size: Int,
//     root_list: dataBinary,
//     index: Boolean,
//     cell_data: dataBinary
//     crc32c: Int
// }
class DataDeserializer {
  static deserializeBoc(boc) {
    let decerializedBoc = {};
    decerializedBoc.magic = boc.readUIntBE(0, 4);

    let b = boc[4];
    decerializedBoc.has_idx = b & (1 << 7);
    decerializedBoc.has_crc32c = b & (1 << 6);
    decerializedBoc.has_cache_bits = b & (1 << 5);
    decerializedBoc.flags = b & (3 << 3);
    decerializedBoc.size = b & 7;
    decerializedBoc.off_bytes = boc[5];

    let offset = 6;
    decerializedBoc.cells = boc.readUIntBE(offset, decerializedBoc.size);
    offset += decerializedBoc.size;

    decerializedBoc.roots = boc.readUIntBE(offset, decerializedBoc.size);
    offset += decerializedBoc.size;

    decerializedBoc.absent = boc.readUIntBE(offset, decerializedBoc.size);
    offset += decerializedBoc.size;

    decerializedBoc.tot_cells_size = boc.readUIntBE(
      offset,
      decerializedBoc.off_bytes
    );
    offset += decerializedBoc.off_bytes;

    decerializedBoc.root_list = boc.slice(
      offset,
      (offset += decerializedBoc.roots * decerializedBoc.size)
    );

    if (decerializedBoc.has_idx) {
      decerializedBoc.index = boc.slice(
        offset,
        (offset += decerializedBoc.cells * decerializedBoc.off_bytes)
      );
    }
    decerializedBoc.data = boc.slice(
      offset,
      (offset += decerializedBoc.tot_cells_size)
    );
    if (decerializedBoc.has_crc32c) {
      decerializedBoc.index = boc.readUIntBE(offset, 4);
    }
    return decerializedBoc;
  }
}

async function main(client) {
  let registerAddr =
    "-1:20609b46cd4fe654b72f8ecddde986f6484dc13e737fd109b36ca73b77b6a098";
  let queryClient = new QueryClient(client);
  const account = await queryClient.getAccount(registerAddr);

  const buffer = Buffer.from(account[0].data, "base64");
  console.log(DataDeserializer.deserializeBoc(buffer));
  let dataBinary = buffer.reduce((binStr, el) => {
    return binStr + el.toString(2).padStart(8, "0");
  }, "");
}

(async () => {
  try {
    const client = new TONClient();
    client.config.setData({
      servers: ["https://testnet.ton.dev"]
    });
    await client.setup();
    await main(client);
    process.exit(0);
  } catch (error) {
    console.error(error);
  }
})();