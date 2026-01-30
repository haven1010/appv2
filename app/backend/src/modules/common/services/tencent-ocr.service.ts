
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as tencentcloud from 'tencentcloud-sdk-nodejs';

const OcrClient = tencentcloud.ocr.v20181119.Client;

@Injectable()
export class TencentOcrService {
  private client: any;
  private readonly logger = new Logger(TencentOcrService.name);

  constructor(private configService: ConfigService) {
    const secretId = this.configService.get<string>('TENCENT_SECRET_ID');
    const secretKey = this.configService.get<string>('TENCENT_SECRET_KEY');
    const region = this.configService.get<string>('TENCENT_REGION') || 'ap-guangzhou';

    if (secretId && secretKey) {
      const clientConfig = {
        credential: {
          secretId,
          secretKey,
        },
        region,
        profile: {
          httpProfile: {
            endpoint: "ocr.tencentcloudapi.com",
          },
        },
      };
      this.client = new OcrClient(clientConfig);
    }
  }

  /**
   * Recognize ID Card (Front or Back)
   * @param imageUrl URL or Base64 of the image
   * @param side 'FRONT' | 'BACK'
   */
  async recognizeIdCard(imageUrl: string, side: 'FRONT' | 'BACK' = 'FRONT') {
    if (!this.client) {
      throw new HttpException('OCR Service not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const params = {
      ImageUrl: imageUrl,
      CardSide: side,
      Config: JSON.stringify({ CropIdCard: true, CropPortrait: true }), // Optional: return cropped images
    };

    try {
      const result = await this.client.IDCardOCR(params);
      this.logger.log(`OCR Success: ${result.Name} - ${result.IdNum}`);
      
      // Normalize return data
      return {
        name: result.Name,
        idNum: result.IdNum,
        address: result.Address,
        birth: result.Birth,
        sex: result.Sex,
        nation: result.Nation,
        raw: result,
      };
    } catch (error) {
      this.logger.error('OCR Failed', error);
      throw new HttpException(`OCR Failed: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }
}
