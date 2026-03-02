import { describe, it, expect } from 'vitest';
import {
  stripTypeModuleAttribute,
  stripParcelExportPrelude,
} from '../scripts/postprocess-build.mjs';

describe('build post-processing', () => {
  it('removes type=module from built HTML', () => {
    const html = '<script type=module src="./index.js"></script>';
    expect(stripTypeModuleAttribute(html)).toBe('<script src="./index.js"></script>');
  });

  it('removes Parcel export prelude from built JS bundles', () => {
    const js = 'let{A,B}=parcelRequire123;export{A as foo,B as bar};console.log("after");';
    expect(stripParcelExportPrelude(js)).toBe('console.log("after");');
  });
});
