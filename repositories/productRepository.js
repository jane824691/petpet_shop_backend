import db from "../utils/connect-mysql.js";

class ProductRepository {
  async createProduct(productData) {
    const sql = `INSERT INTO product 
      (category_id, product_name, product_price, stock, sales_condition, product_img ,product_description, product_name_en, product_description_en, edit_time) 
      VALUES (?, ?, ?, ?, '上架中', ?, ?, ?, ?, CONVERT_TZ(NOW(), '+00:00', '+08:00'))`;

    const params = [
      productData.categoryId,
      productData.nameZh,
      productData.price,
      productData.stock,
      productData.productImg,
      productData.descriptionZh,
      productData.nameEn,
      productData.descriptionEn,
    ];

    const [result] = await db.query(sql, params);
    return result;
  }

  async createProductMultipleImg(pid, multipleImages) {
    if (!Array.isArray(multipleImages) || multipleImages.length === 0) {
      return { affectedRows: 0, insertId: 0 };
    }

    const rows = multipleImages.map((v) => [
      pid,
      v.photo_path,
      v.sort_order,
    ]);

    const sql =
      "INSERT INTO `product_multiple_img`(`pid`, `photo_path`, `sort_order`) VALUES ?";
    const [result] = await db.query(sql, [rows]);
    return result;
  }

  // 查詢單一商品主表，供編輯前比對用
  async findProductById(pid) {
    const [rows] = await db.query(
      `SELECT pid, category_id, product_name, product_name_en, product_price, stock,
        product_img, product_description, product_description_en, sales_condition
       FROM product WHERE pid = ?`,
      [pid]
    );
    return rows[0] ?? null;
  }

  // 查詢商品多圖，供編輯前比對用
  async findProductMultipleImgByPid(pid) {
    const [rows] = await db.query(
      `SELECT photo_path, sort_order FROM product_multiple_img WHERE pid = ? ORDER BY sort_order ASC`,
      [pid]
    );
    return rows;
  }

  // 動態組 UPDATE，只更新傳入的欄位
  async updateProductPartial(pid, fields) {
    const columnMap = {
      category_id: "category_id",
      product_name: "product_name",
      product_name_en: "product_name_en",
      product_price: "product_price",
      stock: "stock",
      sales_condition: "sales_condition",
      product_img: "product_img",
      product_description: "product_description",
      product_description_en: "product_description_en",
    };
    const setParts = [];
    const params = [];

    for (const [key, value] of Object.entries(fields)) {
      if (!columnMap[key]) continue;
      setParts.push(`${key} = ?`);
      params.push(value);
    }

    if (setParts.length === 0) {
      return { affectedRows: 0, changedRows: 0 };
    }

    setParts.push(`edit_time = CONVERT_TZ(NOW(), '+00:00', '+08:00')`);
    const sql = `UPDATE product SET ${setParts.join(", ")} WHERE pid = ?`;
    params.push(pid);

    const [result] = await db.query(sql, params);
    return result;
  }

  // 多圖有變時先刪除舊資料，再批次 INSERT 新清單
  async deleteProductMultipleImgByPid(pid) {
    const [result] = await db.query(
      `DELETE FROM product_multiple_img WHERE pid = ?`,
      [pid]
    );
    return result;
  }

  async deleteProduct(pid) {
    const sql = `DELETE p, pm
FROM product p
LEFT JOIN product_multiple_img pm ON p.pid = pm.pid
WHERE p.pid = ? AND p.pid >= 205;`;
    const [result] = await db.query(sql, [pid]);
    return result;
  }
}

export default new ProductRepository();
