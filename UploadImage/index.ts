import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
//const { BlobServiceClient } = require('@azure/storage-blob');

require("dotenv").config();

const clean = (obj) => {
  for (const key in obj) {
    if (obj[key] === null || obj[key] === undefined) delete obj[key];
  }
  delete obj.created_at;
  delete obj.updated_at;
  delete obj.created_by;
  return obj;
};

const connString = process.env.AZURE_STORAGE_CONNECTION_STRING || "";
const CONTAINER_NAME = process.env.CONTAINER_NAME || "";
if (!connString) throw Error("Azure Storage Connection string not found");

const client = BlobServiceClient.fromConnectionString(connString);

async function upload(containerClient, blobName, file) {
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(file.value, {
    blobHTTPHeaders: { blobContentType: file.contentType },
  });
}
async function uploadMultiple(fields, files) {
  let blobs = [];
  const containerClient = await client.getContainerClient(CONTAINER_NAME);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const id = fields[i];
    blobs.push(
      (async () => {
        const blobName = `${id}`;
        const image_path = `https://${process.env.AZURE_CONTAINER}.blob.core.windows.net/${CONTAINER_NAME}/${blobName}`;
        await upload(containerClient, blobName, file);
        return {
          id,
          image_path,
          image_name: `${id}_${file.fileName}`,
          status: "finished",
        };
      })()
    );
  }
  return await Promise.all(blobs);
}

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  try {
    const fields = req
      .parseFormBody()
      .getAll("uuid")
      .map((buf) => buf.value.toString());
    const files = req.parseFormBody().getAll("file");
    const Authorization = req.headers["authorization"];
    const blobs = await uploadMultiple(fields, files);
    const body = JSON.stringify(blobs.map(clean));
    const response = await fetch(
      `${process.env.BASE_URL}/api/v2/image/multiple`,
      {
        method: "PUT",
        headers: {
          Authorization,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body,
      }
    );
    if (response.ok) {
      context.log.info(`Request (PUT)[${response.status}]: ${response.url}`);
      const data = await response.json();
      context.res = {
        body: data,
      };
    } else {
      const data = await response.json();
      context.log.warn(
        `Request (PUT)[${response.status}]: ${response.url} - ${response.statusText}\n${data}`
      );
      context.res = {
        status: response.status,
        body: {
          error: response.statusText,
          body: data,
        },
      };
    }
  } catch (err) {
    context.log.error(`Request [500]: Function - Internal error\n${err}`);
    context.res = {
      status: 500,
      body: err,
    };
  }
};

export default httpTrigger;
