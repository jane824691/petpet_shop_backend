import tinify from "tinify";
import admin from "../utils/connect-firebase.js";
import { v4 as uuidv4 } from "uuid";
import productRepository from "../repositories/productRepository.js";

const bucket = admin.storage().bucket();

class ProductService {
  validateFiles(files) {
    const allFiles = Object.values(files).flat();

    if (allFiles.length === 0) {
      throw new Error("至少上傳 1 張圖片");
    }

    if (allFiles.length > 4) {
      throw new Error("最多 4 張圖片");
    }

    return allFiles;
  }

  async uploadImages(files) {
    const allFiles = this.validateFiles(files);
    const uploadResults = [];

    for (let file of allFiles) {
      const buffer = await tinify.fromBuffer(file.buffer).toBuffer();
      const blob = bucket.file(`productsImg/${uuidv4()}.${file.originalname.split(".").pop()}`);

      await new Promise((resolve, reject) => {
        const stream = blob.createWriteStream({
          metadata: { contentType: file.mimetype }
        });

        stream.on("finish", resolve);
        stream.on("error", reject);
        stream.end(buffer);
      });

      const [url] = await blob.getSignedUrl({
        action: "read",
        expires: "03-09-2491",
      });

      uploadResults.push({
        fileName: blob.name,
        imgUrl: url,
      });
    }

    return uploadResults;
  }

  async createProduct(productData, files) {
    const uploadResults = await this.uploadImages(files);

    const productResult = await productRepository.createProduct({
      ...productData,
      productImg: uploadResults[0].imgUrl,
    });

    const insertedPid = productResult.insertId;

    const multipleImgResult = await productRepository.createProductMultipleImg(
      insertedPid,
      uploadResults
    );

    return {
      product: productResult,
      product_multiple_img: multipleImgResult,
    };
  }
}

export default new ProductService();
