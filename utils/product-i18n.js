import { getTranslation } from './i18n.js';

/**
 * 處理商品資料，回傳包含中英文雙語的完整資訊
 * @param {Array} products - 商品陣列
 * @returns {Array} 處理後的商品陣列
 */
export const localizeProducts = (products) => {
  if (!Array.isArray(products)) {
    return products;
  }

  return products.map(product => localizeProduct(product));
};

/**
 * 處理單一商品資料，回傳包含中英文雙語的完整資訊
 * @param {Object} product - 商品物件
 * @returns {Object} 處理後的商品物件
 */
export const localizeProduct = (product) => {
  if (!product) return product;
  
  const localizedProduct = { ...product };
  
  // 確保中英文欄位都存在
  localizedProduct.product_name_zh = product.product_name || '';
  localizedProduct.product_name_en = product.product_name_en || product.product_name || '';
  localizedProduct.product_description_zh = product.product_description || '';
  localizedProduct.product_description_en = product.product_description_en || product.product_description || '';
  

  return localizedProduct;
};

/**
 * 將中文銷售狀態轉換為翻譯鍵值
 * @param {string} salesCondition - 銷售狀態
 * @returns {string} 翻譯鍵值
 */
const getSalesConditionKey = (salesCondition) => {
  const conditionMap = {
    '可購買': 'available',
    '已售完': 'sold_out',
    '已下架': 'discontinued'
  };
  
  return conditionMap[salesCondition] || 'available';
};

/**
 * 構建搜尋條件，支援中英文搜尋
 * @param {string} searchWord - 搜尋關鍵字
 * @returns {string} SQL WHERE 條件
 */
export const buildSearchCondition = (searchWord) => {
  if (!searchWord) return '';
  
  const escapedSearch = `%${searchWord}%`;
  
  // 搜尋中英文欄位
  return `AND (product_name LIKE '${escapedSearch}' OR product_description LIKE '${escapedSearch}' OR product_name_en LIKE '${escapedSearch}' OR product_description_en LIKE '${escapedSearch}')`;
}; 