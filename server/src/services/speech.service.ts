/**
 * Speech-to-text and text-to-speech using Azure Speech. This module has no
 * knowledge of iLocate, Foundry, or asset data.
 *
 * The browser records audio via MediaRecorder (webm/opus) rather than raw
 * WAV -- Azure Speech SDK's Node bindings only accept WAV directly
 * (`AudioConfig.fromWavFileInput`); compressed formats require GStreamer
 * installed on the host OS, which this project avoids requiring. Instead,
 * uploaded clips are transcoded to 16kHz mono WAV with a bundled static
 * ffmpeg binary (ffmpeg-static), so `npm install` alone is enough to run.
 */
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AppConfig } from '../config/environment.js';
import { Errors } from '../models/errors.js';
import { logger } from '../config/logger.js';

ffmpeg.setFfmpegPath(ffmpegPath as unknown as string);

export interface TranscriptionResult {
  text: string;
  noSpeech: boolean;
}

async function transcodeToWav(inputBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const id = crypto.randomUUID();
  const inputPath = path.join(tmpDir, `ilocate-stt-${id}.webm`);
  const outputPath = path.join(tmpDir, `ilocate-stt-${id}.wav`);

  await fs.writeFile(inputPath, inputBuffer);
  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFrequency(16000)
        .audioChannels(1)
        .audioCodec('pcm_s16le')
        .format('wav')
        .on('error', reject)
        .on('end', () => resolve())
        .save(outputPath);
    });
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(inputPath, { force: true });
    await fs.rm(outputPath, { force: true });
  }
}

export class SpeechService {
  constructor(private readonly config: AppConfig) {}

  private buildSpeechConfig(): sdk.SpeechConfig {
    const speechConfig = sdk.SpeechConfig.fromSubscription(this.config.speechKey, this.config.speechRegion);
    speechConfig.speechSynthesisVoiceName = this.config.speechVoice;
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
    return speechConfig;
  }

  async transcribe(audioBuffer: Buffer): Promise<TranscriptionResult> {
    let wavBuffer: Buffer;
    try {
      wavBuffer = await transcodeToWav(audioBuffer);
    } catch (err) {
      logger.error('Audio transcode failed', { error: err instanceof Error ? err.message : String(err) });
      throw Errors.speechServiceError();
    }

    return new Promise<TranscriptionResult>((resolve, reject) => {
      const speechConfig = this.buildSpeechConfig();
      const audioConfig = sdk.AudioConfig.fromWavFileInput(wavBuffer);
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      recognizer.recognizeOnceAsync(
        (result) => {
          recognizer.close();
          if (result.reason === sdk.ResultReason.RecognizedSpeech) {
            resolve({ text: result.text, noSpeech: false });
          } else if (result.reason === sdk.ResultReason.NoMatch) {
            resolve({ text: '', noSpeech: true });
          } else {
            const details = sdk.CancellationDetails.fromResult(result);
            logger.error('Speech recognition canceled', { reason: String(details.reason), details: details.errorDetails });
            reject(Errors.speechServiceError());
          }
        },
        (err) => {
          recognizer.close();
          logger.error('Speech recognition failed', { error: String(err) });
          reject(Errors.speechServiceError());
        },
      );
    });
  }

  async synthesize(text: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const speechConfig = this.buildSpeechConfig();
      // No audioConfig -> not played locally; result.audioData holds the bytes to return to the browser.
      const synthesizer = new sdk.SpeechSynthesizer(speechConfig, undefined);

      synthesizer.speakTextAsync(
        text,
        (result) => {
          synthesizer.close();
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve(Buffer.from(result.audioData));
          } else {
            logger.error('Speech synthesis did not complete', { reason: String(result.reason) });
            reject(Errors.speechServiceError());
          }
        },
        (err) => {
          synthesizer.close();
          logger.error('Speech synthesis failed', { error: String(err) });
          reject(Errors.speechServiceError());
        },
      );
    });
  }
}
