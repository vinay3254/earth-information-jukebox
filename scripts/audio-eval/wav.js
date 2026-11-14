// Audio buffer to 16-bit PCM RIFF WAV encoder
export function encodeWav(left, right, sampleRate = 48000) {
  const numChannels = right ? 2 : 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = left.length;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  if (numChannels === 2) {
    for (let i = 0; i < numSamples; i++) {
      const sL = Math.max(-1, Math.min(1, left[i]));
      const sR = Math.max(-1, Math.min(1, right[i]));
      buffer.writeInt16LE(sL < 0 ? sL * 0x8000 : sL * 0x7FFF, offset);
      offset += 2;
      buffer.writeInt16LE(sR < 0 ? sR * 0x8000 : sR * 0x7FFF, offset);
      offset += 2;
    }
  } else {
    for (let i = 0; i < numSamples; i++) {
      const sL = Math.max(-1, Math.min(1, left[i]));
      buffer.writeInt16LE(sL < 0 ? sL * 0x8000 : sL * 0x7FFF, offset);
      offset += 2;
    }
  }

  return buffer;
}
