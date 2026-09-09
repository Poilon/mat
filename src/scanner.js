import { BrowserMultiFormatOneDReader } from '@zxing/browser';

window.MietteScanner = {
  async camera(video, onResult) {
    const reader = new BrowserMultiFormatOneDReader();
    return reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false }, video, (result, error, controls) => {
      if (result) onResult(result.getText(), controls);
    });
  },
  async image(file) {
    const url = URL.createObjectURL(file);
    try { return (await new BrowserMultiFormatOneDReader().decodeFromImageUrl(url)).getText(); }
    finally { URL.revokeObjectURL(url); }
  }
};
