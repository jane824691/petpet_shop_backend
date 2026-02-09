import productService from "../services/productService.js";

class ProductController {
    async createProduct(req, res) {
        const output = {
            success: false,
            postData: req.body,
        };

        const {
            categoryId,
            productName,
            productPrice,
            stock,
            productDescription,
            productNameEn,
            productDescriptionEn,
        } = req.body;

        try {
            const result = await productService.createProduct(
                {
                    categoryId,
                    productName,
                    productPrice,
                    stock,
                    productDescription,
                    productNameEn,
                    productDescriptionEn,
                },
                req.files
            );

            output.success = true;
            output.result = result;
            res.json(output);
        } catch (err) {
            console.error(err);
            output.exception = {
                message: err.message,
                stack: err.stack,
            };
            res.status(500).json(output);
        }
    }
}

export default new ProductController();
