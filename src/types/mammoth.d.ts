declare module "mammoth/mammoth.browser.js" {
  interface Result {
    value: string;
    messages: unknown[];
  }
  const mammoth: {
    extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<Result>;
    convertToHtml(input: { arrayBuffer: ArrayBuffer }): Promise<Result>;
  };
  export default mammoth;
}
