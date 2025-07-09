import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 初始化 i18next
await i18next
  .use(Backend)
  .init({
    backend: {
      loadPath: path.join(__dirname, '../data/translations/{{lng}}/{{ns}}.json'),
      addPath: path.join(__dirname, '../data/translations/{{lng}}/{{ns}}.json'),
    },
    fallbackLng: 'zh-TW',
    preload: ['zh-TW', 'en-US'],
    ns: ['common', 'products', 'orders', 'comments'],
    defaultNS: 'common',
    debug: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18next;

// 語言檢測中間件
export const languageMiddleware = (req, res, next) => {
  // 從請求標頭、查詢參數或會話中獲取語言設定
  const lang = req.headers['accept-language'] || 
               req.query.lang || 
               req.session?.lang || 
               'zh-TW';
  
  // 標準化語言代碼
  const normalizedLang = lang.startsWith('zh') ? 'zh-TW' : 
                        lang.startsWith('en') ? 'en-US' : 'zh-TW';
  
  req.language = normalizedLang;
  req.t = i18next.getFixedT(normalizedLang);
  
  next();
};

// 獲取翻譯的輔助函數
export const getTranslation = (language, key, options = {}) => {
  return i18next.t(key, { lng: language, ...options });
}; 