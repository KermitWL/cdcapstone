import * as AWS from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk'
import { createLogger } from '../utils/logger'

const XAWS = AWSXRay.captureAWS(AWS)
const logger = createLogger('File storage logic')

export class AttachmentUtils {
    constructor(
        private readonly bucketName = process.env.ATTACHMENT_S3_BUCKET,
        private readonly s3 = new XAWS.S3({
            signatureVersion: 'v4'
          }),
    private readonly urlExpiration = Number(process.env.SIGNED_URL_EXPIRATION)
    ) {}

    async getUploadURL(todoId: string): Promise<string> {
        logger.info("getting presigned url for todo " + todoId)
        
        return this.s3.getSignedUrl('putObject', {
            Bucket: this.bucketName,
            Key: todoId,
            Expires: this.urlExpiration
          })
    }

}

