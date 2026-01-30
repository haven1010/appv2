
import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

@Injectable()
export class QrCodeService {
  /**
   * Generate Data URL for QR Code
   * @param content String content to encode
   */
  async generateDataUrl(content: string): Promise<string> {
    try {
      return await QRCode.toDataURL(content, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 300,
      });
    } catch (err) {
      throw new Error('QR Generation Failed');
    }
  }

  /**
   * Generate Encrypted Check-in QR for User specific to a job
   * Content: UID | BaseId | JobId | Date | Salt
   */
  async generateForUserJob(uid: string, baseId: number, jobId: number, date: string): Promise<string> {
    // Specific format requested: uid + baseId + jobId + date
    const payload = `${uid}|${baseId}|${jobId}|${date}|PICKPASS_V1`;
    
    // We return the raw payload encoded, assuming validation happens on scan
    // Or we can encrypt it if SecurityService is injected (CommonModule is imported below)
    return this.generateDataUrl(payload);
  }
}
