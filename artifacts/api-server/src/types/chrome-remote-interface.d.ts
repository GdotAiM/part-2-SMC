declare module "chrome-remote-interface" {
  import { Protocol } from "chrome-remote-interface";
  export { Protocol };
  export default function CDP(options?: {
    host?: string;
    port?: number;
    target?: string;
  }): Promise<Protocol>;
}
