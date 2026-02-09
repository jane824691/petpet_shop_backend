import db from "../utils/connect-mysql.js";

class ProductRepository {
  async createProduct(productData) {
    const sql = `INSERT INTO product 
      (category_id, product_name, product_price, stock, sales_condition, product_img ,product_description, product_name_en, product_description_en, edit_time) 
      VALUES (?, ?, ?, ?, '上架中', ?, ?, ?, ?, CONVERT_TZ(NOW(), '+00:00', '+08:00'))`;

    const params = [
      productData.categoryId,
      productData.productName,
      productData.productPrice,
      productData.stock,
      productData.productImg,
      productData.productDescription,
      productData.productNameEn,
      productData.productDescriptionEn,
    ];

    const [result] = await db.query(sql, params);
    return result;
  }

  async createProductMultipleImg(pid, imageUrls) {
    const urls = imageUrls.slice(1, 4).map(v => v.imgUrl);
    const [main = null, secondary = null, content = null] = urls;
    const row = [pid, main, secondary, content];
    const values = [row];

    const sql = "INSERT INTO `product_multiple_img`(`pid`, `photo_content_main`, `photo_content_secondary`, `photo_content`) VALUES ?";
    const [result] = await db.query(sql, [values]);
    return result;
  }
}

export default new ProductRepository();
