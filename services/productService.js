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

    return { imgUrl: url };
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

  // 解析前端送來的 images（陣列或 JSON 字串）；未送則回傳 null
  parseExistingImages(imagesBody) {
    if (imagesBody === undefined || imagesBody === null || imagesBody === "") {
      return null;
    }
    if (Array.isArray(imagesBody)) return imagesBody;
    if (typeof imagesBody === "string") {
      try {
        const parsed = JSON.parse(imagesBody);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  // 判斷是否為可沿用的圖片參照（Firebase URL 或 DB 純檔名字串）
  isValidImageRef(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  // 依 sortOrder 排序（有值才排）；否則維持陣列順序
  sortImagesByOrder(rows) {
    const list = rows.filter((row) =>
      this.isValidImageRef(row.photo_path ?? row.photoPath)
    );
    const allHaveOrder = list.every(
      (row) =>
        (row.sort_order ?? row.sortOrder) !== undefined &&
        (row.sort_order ?? row.sortOrder) !== null &&
        (row.sort_order ?? row.sortOrder) !== ""
    );
    if (!allHaveOrder) return list;
    return list.sort(
      (a, b) =>
        Number(a.sort_order ?? a.sortOrder) -
        Number(b.sort_order ?? b.sortOrder)
    );
  }

  // 多圖統一格式，先依 sortOrder 排序，再重排 sort_order 為 0,1,2...
  normalizeMultipleRows(rows) {
    return this.sortImagesByOrder(rows)
      .map((row, index) => ({
        photo_path: String(row.photo_path ?? row.photoPath ?? "").trim(),
        sort_order: index,
      }))
      .filter((row) => this.isValidImageRef(row.photo_path));
  }

  // 比對多圖 photo_path 順序是否相同，相同則略過寫入
  multipleImagesEqual(a, b) {
    const left = this.normalizeMultipleRows(a).map((r) => r.photo_path);
    const right = this.normalizeMultipleRows(b).map((r) => r.photo_path);
    if (left.length !== right.length) return false;
    return left.every((path, i) => path === right[i]);
  }

  // 僅收集有送且與 DB 不同的文字欄位，用於部分更新
  buildTextUpdateFields(existing, productData) {
    const fields = {};
    const setIfDefined = (bodyKey, dbKey, transform = (v) => v) => {
      if (productData[bodyKey] === undefined) return;
      const next = transform(productData[bodyKey]);
      if (String(next) !== String(existing[dbKey] ?? "")) {
        fields[dbKey] = next;
      }
    };

    setIfDefined("categoryId", "category_id");
    setIfDefined("nameZh", "product_name");
    setIfDefined("nameEn", "product_name_en");
    setIfDefined("price", "product_price");
    setIfDefined("stock", "stock");
    setIfDefined("descriptionZh", "product_description");
    setIfDefined("descriptionEn", "product_description_en");

    return fields;
  }

  // 決定主圖：新檔上傳 Firebase；否則沿用 body/DB；回傳是否需更新 DB
  async resolveProductImg(files, bodyProductImg, existingProductImg) {
    if (files?.productImg?.[0]) {
      const uploaded = await this.uploadImage(files.productImg[0]);
      return {
        value: uploaded.imgUrl,
        changed: uploaded.imgUrl !== existingProductImg,
      };
    }

    if (this.isValidImageRef(bodyProductImg)) {
      const value = bodyProductImg.trim();
      return {
        value,
        changed: value !== existingProductImg,
      };
    }

    return { value: existingProductImg, changed: false };
  }

  // 決定多圖清單：existingImages(JSON) 保留舊圖 + images(File) 新圖，不可共用同一 key
  async resolveMultipleImages(
    files,
    existingImagesBody,
    existingRows,
    { existingImagesProvided = false } = {}
  ) {
    const newFiles = Array.isArray(files?.images) ? files.images : [];
    const parsedBody = this.parseExistingImages(existingImagesBody);

    if (!existingImagesProvided && newFiles.length === 0) {
      return { images: existingRows, changed: false };
    }

    let keptFromBody = [];
    if (existingImagesProvided) {
      keptFromBody = this.normalizeMultipleRows(
        (parsedBody ?? []).map((item) => ({
          photo_path: item.photoPath ?? item.photo_path ?? "",
          sort_order: item.sortOrder ?? item.sort_order,
        }))
      );
    }

    if (newFiles.length === 0) {
      const target = existingImagesProvided ? keptFromBody : existingRows;
      return {
        images: this.normalizeMultipleRows(target),
        changed: !this.multipleImagesEqual(target, existingRows),
      };
    }

    if (keptFromBody.length === 0 && existingImagesProvided) {
      throw new Error("existingImages 格式錯誤或為空");
    }

    const uploaded = [];
    for (const file of newFiles) {
      const result = await this.uploadImage(file);
      uploaded.push({ photo_path: result.imgUrl });
    }

    const merged = this.normalizeMultipleRows([
      ...keptFromBody.map((r) => ({ photo_path: r.photo_path })),
      ...uploaded,
    ]).slice(0, 3);

    return {
      images: merged,
      changed: !this.multipleImagesEqual(merged, existingRows),
    };
  }

  // 編輯商品：部分更新文字與主圖，多圖有變才刪除重建
  async updateProduct(
    pid,
    productData,
    files,
    { existingImagesProvided = false } = {}
  ) {
    if (!pid || pid < 1) {
      throw new Error("pid 為必須");
    }

    const existing = await productRepository.findProductById(pid);
    if (!existing) {
      throw new Error("商品不存在");
    }

    const existingMultiple =
      await productRepository.findProductMultipleImgByPid(pid);

    const { value: productImg, changed: productImgChanged } =
      await this.resolveProductImg(
        files,
        productData.productImg,
        existing.product_img
      );

    const { images: multipleImages, changed: multipleChanged } =
      await this.resolveMultipleImages(
        files,
        productData.existingImages,
        existingMultiple,
        { existingImagesProvided }
      );

    if (multipleImages.length > 3) {
      throw new Error("最多 3 張多圖");
    }

    const updateFields = this.buildTextUpdateFields(existing, productData);
    if (productImgChanged) {
      updateFields.product_img = productImg;
    }

    let productResult = { affectedRows: 0, changedRows: 0 };
    if (Object.keys(updateFields).length > 0) {
      productResult = await productRepository.updateProductPartial(
        pid,
        updateFields
      );
    }

    let multipleImgResult = { affectedRows: 0, insertId: 0 };
    if (multipleChanged) {
      await productRepository.deleteProductMultipleImgByPid(pid);
      multipleImgResult = await productRepository.createProductMultipleImg(
        pid,
        multipleImages
      );
    }

    return {
      product: productResult,
      product_multiple_img: multipleImgResult,
    };
  }

  async deleteProduct(pid) {
    if (!pid || pid < 205) {
      throw new Error("No. 為必須, 目前只允許刪除No.204以後的商品");
    }
    const result = await productRepository.deleteProduct(pid);
    return result;
  }
}
export default new ProductService();
