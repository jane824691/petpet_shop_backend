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
