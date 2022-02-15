// toin - Table of Integer Numbers

// The first bit stores information about whether negative numbers can be stored here
//   (0 - cannot, 1 - can)
// The remaining 7 bits store information about how many bytes to allocate to store each number
//   (must be divisible by 8 or if less than 1024)
// The next byte stores information about how many columns should be in the table

// This class does not include all of the things you can do with a buffer
// But for now it's enough for me.

const bufferPrototipe = {
  add(array) {
    this.buffer = ftin.add(this.buffer, array);
  },
};

class ftin {
  open(buffer) {
    const bufObject = {
      buffer,
      ...ftin.getPropertiesFtin(buffer),
    };
    Object.setPrototypeOf(bufObject, bufferPrototipe);

    return bufObject;
  }

  static create(array, options = {}) {
    options = { negative: false, bits: 64, ...options };

    if (!array.length || !array[0].length) throw 'array shuld be non empty';

    const bytes = options.bits / 8;
    const bytesOnLine = array[0].length * bytes;

    const buf = Buffer.alloc(2 + array.length * bytesOnLine);
    buf[0] = options.negative * 128 + bytes;
    buf[1] = array[0].length;

    array.forEach((line, itemLine) => {
      line.forEach((num, itemNum) => {
        for (let i = bytes - 1; i >= 0; i--) {
          buf[2 + (itemLine * bytesOnLine + itemNum * bytes) + i] = num % 256;
          num = Math.trunc(num / 256);
        }
      });
    });

    return buf;
  }

  static read(buf) {
    const { bytes, lineLength } = ftin.getPropertiesFtin(buf);
    const bytesOnLine = lineLength * bytes;

    const data = new Array((buf.length - 2) / bytes / lineLength).fill(
      new Array(lineLength).fill(0)
    );

    for (let itemLine = 0; itemLine < data.length; itemLine++) {
      const line = data[itemLine];

      data[itemLine] = line.map((num, itemNum) => {
        const firstBit = 2 + (itemLine * bytesOnLine + itemNum * bytes);
        const binNum = buf.slice(firstBit, firstBit + bytes);
        for (let i = 0; i < bytes; i++) {
          num += buf[2 + (itemLine * bytesOnLine + itemNum * bytes) + i] * 256 ** (bytes - i - 1);
        }
        return num;
      });
    }

    return data;
  }

  static getPropertiesFtin(buf) {
    const negative = Math.trunc(buf[0] / 128);
    const bytes = buf[0] - negative * 128;
    const lineLength = buf[1];
    return { negative, bytes, lineLength, bits: bytes * 8 };
  }

  static add(buf, array) {
    console.log(ftin.getPropertiesFtin(buf));
    return Buffer.concat([buf, ftin.create(array, ftin.getPropertiesFtin(buf)).subarray(2)]);
  }
}

export default ftin;
