import tinify from "tinify";
import admin from "../utils/connect-firebase.js";
import { v4 as uuidv4 } from "uuid";
import productRepository from "../repositories/productRepository.js";

tinify.key = process.env.TINYPNG_API_KEY;

const bucket = admin.storage().bucket();

class ProductService {
  validateFiles(files) {
    const productImgFile = files?.productImg?.[0];
    if (!productImgFile) {
      throw new Error("productImg 為必須");
    }

    const images = Array.isArray(files?.images) ? files.images : [];
    if (images.length > 3) {
      throw new Error("最多 3 張多圖");
    }

    return { productImgFile, images };
  }

  async uploadImage(file) {
    // 壓縮圖片後上傳到 Firebase Storage，回傳可讀 URL 與 mime_type
    const buffer = await tinify.fromBuffer(file.buffer).toBuffer();
    const blob = bucket.file(
      `productsImg/${uuidv4()}.${file.originalname.split(".").pop()}`
    );

    await new Promise((resolve, reject) => {
      const stream = blob.createWriteStream({
        metadata: { contentType: file.mimetype },
      });

      stream.on("finish", resolve);
      stream.on("error", reject);
      stream.end(buffer);
    });

    const [url] = await blob.getSignedUrl({
      action: "read",
      expires: "03-09-2491",
    });

    return { imgUrl: url};
  }

  async createProduct(productData, files) {
    // 建立商品主資料 + 多圖（依 sort_order 決定順序）
    const { productImgFile, images } = this.validateFiles(files);
    // productImg：商品主圖（只用第一張）
    const productImg = await this.uploadImage(productImgFile);

    const multipleImages = [];
    for (let i = 0; i < images.length; i++) {
      const uploaded = await this.uploadImage(images[i]);
      multipleImages.push({
        photo_path: uploaded.imgUrl,
        sort_order: i,
      });
    }

    // 寫入 product 表：取得 pid（insertId）
    const productResult = await productRepository.createProduct({
      ...productData,
      productImg: productImg.imgUrl,
    });

    const insertedPid = productResult.insertId;

    // 寫入 product_multiple_img：多筆（pid, photo_path, sort_order, mime_type）
    const multipleImgResult = await productRepository.createProductMultipleImg(
      insertedPid,
      multipleImages
    );

    return {
      product: productResult,
      product_multiple_img: multipleImgResult,
    };
  }
}

export default new ProductService();
