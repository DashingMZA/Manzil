// Minimal flat config. `eslint-config-next` add karna ho to:
//   import next from "eslint-config-next/flat";
//   export default [...next(), { ignores: [...] }];
// Next 16 ke saath uska export shape check kar lein.
export default [
  {
    ignores: ["out/**", ".next/**", "src-tauri/**", "node_modules/**"],
  },
];
