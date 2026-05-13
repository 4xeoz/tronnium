export const pipeline = jest.fn().mockResolvedValue(
  jest.fn().mockResolvedValue({
    data: new Float32Array([0.1, 0.2, 0.3]),
  })
);
