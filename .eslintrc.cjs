module.exports = {
    env: {
        es2021: true,
        node: true,
        jest: true,
    },
    extends: ["plugin:@typescript-eslint/recommended", "standard"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: 12,
        sourceType: "module",
    },
    plugins: ["@typescript-eslint"],
    rules: {
        "no-new": "off",
        camelcase: "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "@typescript-eslint/no-unused-vars": [
            "warn",
            {argsIgnorePattern: "^_.*"},
        ],
        "no-eq-null": "error", // required for mocking the logout function
        "prefer-rest-params": "off"
    },
};