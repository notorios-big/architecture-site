// src/lib/vectors.js - ES Module
export const cosine = (a, b) => {
  let dp = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    dp += x * y;
    ma += x * x;
    mb += y * y;
  }
  return dp / (Math.sqrt(ma) * Math.sqrt(mb));
};
