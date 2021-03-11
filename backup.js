const axios = require("axios");
const outputLocation = require("path").resolve(__dirname, "wc_backup.json");
const fs = require("fs");

const CONSUMER_KEY = "<WOOCOMMERCE_CONSUMER_KEY>";
const CONSUMER_SECRET = "<WOOCOMMERCE_CONSUMER_SECRET>";
const DIR = "./imagebackup";
const PERCENT_MULTIPLIER = 100;
let GLOBAL_DOWNLOAD_COUNTER = 0;
let IMAGE_COUNTER = 0;

const downloadImage = async (url, path) => {
  const writer = fs.createWriteStream(path);

  const response = await axios.get(url, { responseType: "stream" });

  await response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
};

const createJSONBackup = () => {
  return new Promise(async (resolve, reject) => {
    let products = [];
    let productsPerPageCount = 0;
    let page = 1;
    do {
      const res = await axios.get(
        `https://<yoursite.com>/wp-json/wc/v3/products?consumer_key=${CONSUMER_KEY}&consumer_secret=${CONSUMER_SECRET}&per_page=100&page=${page}`
      );
      productsPerPageCount = Object.keys(res.data).length;
      for (var i = 0; i < productsPerPageCount; i++) {
        products.push(res.data[i]);
      }
      page++;
    } while (productsPerPageCount > 0);

    fs.writeFile(
      outputLocation,
      JSON.stringify(products, null, 4),
      function (err) {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          console.log("JSON saved to " + outputLocation);
          resolve(outputLocation);
        }
      }
    );
  });
};

const createImagesBackup = async () => {
  const raw = fs.readFileSync("./wc_backup.json");
  const products = JSON.parse(raw.toString());

  products.forEach((product) => product.images.forEach(() => IMAGE_COUNTER++));

  fs.mkdirSync(DIR, { recursive: true });

  products.forEach(async (product, i) => {
    fs.mkdirSync(DIR + `/${product.id}`, { recursive: true });
  });

  for await (const product of products) {
    for await (const image of product.images) {
      const path = DIR + `/${product.id}/${image.id}.jpeg`;
      console.log("Download image: ", image.id);
      await downloadImage(image.src, path).catch(() => {
        GLOBAL_DOWNLOAD_COUNTER++;
        console.log(
          "Download rejected - ",
          (GLOBAL_DOWNLOAD_COUNTER / IMAGE_COUNTER) * PERCENT_MULTIPLIER,
          "%"
        );
      });
      GLOBAL_DOWNLOAD_COUNTER++;
      console.log(
        "Downloaded image - ",
        (GLOBAL_DOWNLOAD_COUNTER / IMAGE_COUNTER) * PERCENT_MULTIPLIER,
        "%"
      );
    }
  }
};

const promise = createJSONBackup();
Promise.resolve(promise).then(() => createImagesBackup());
