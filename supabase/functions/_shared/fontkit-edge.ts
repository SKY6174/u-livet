// Fontkit 2 uses standard prototype inheritance, supported by the hardened Edge runtime.
// pdf-lib 1.x expects the earlier stream interface for font subsetting.
import { create } from "npm:fontkit@2.0.4";
import { Readable } from "node:stream";
export default {
  create(bytes: Uint8Array) {
    const font = create(bytes);
    const createSubset = font.createSubset.bind(font);
    font.createSubset = () => {
      const subset = createSubset();
      subset.encodeStream = () => Readable.from([subset.encode()]);
      return subset;
    };
    return font;
  },
};
