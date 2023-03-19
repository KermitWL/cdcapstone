import { CustomAuthorizerEvent, CustomAuthorizerResult } from 'aws-lambda'
import 'source-map-support/register'

import { verify } from 'jsonwebtoken'
import { createLogger } from '../../utils/logger'
import { JwtPayload } from '../../auth/JwtPayload'

const logger = createLogger('auth')
const cert = `-----BEGIN CERTIFICATE-----
MIIDHTCCAgWgAwIBAgIJVdW8IcN4Zlz/MA0GCSqGSIb3DQEBCwUAMCwxKjAoBgNV
BAMTIWRldi1tM3U1amFhdm8wd24xNmg1LnVzLmF1dGgwLmNvbTAeFw0yMzAzMDUy
MDIxNTVaFw0zNjExMTEyMDIxNTVaMCwxKjAoBgNVBAMTIWRldi1tM3U1amFhdm8w
d24xNmg1LnVzLmF1dGgwLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC
ggEBANE+Z+bkiUQNmDq/xlEbPeI/dENTwIhFfLaZEOuV2tyQNKehCZS/f4SU1OCE
67WPmws7aQt/fZHuxloNyINZrRqsExti9NG4hPxGapPTThT1NYF/SnbejqyBDnEY
QKsnBTz/hJkHvizd3izX+Ws0wn9XvYirXGXOhCPR5/xIlcqX0Lij2ayUT/KJ0xL+
P/eGWItgqg7Kr6htyEKDgYrq8z6Am5FfKUbfmgoXaTzSehAnO59dn9lVvIaEUby3
8qfLCnRbxl5nd/PgBMb5Vv9oUbsM2wHHpaP071mGvXdhlfEbEZjqOqkCNeiJrEtG
KYCubFv8/VikonnEJ1Xykg4aW+0CAwEAAaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAd
BgNVHQ4EFgQUPsIHXfk35jcwa76ljjn6dsPk4kMwDgYDVR0PAQH/BAQDAgKEMA0G
CSqGSIb3DQEBCwUAA4IBAQAcjAUXRMa5GARL1NokWAJuPkSferoswZBi+NVoHMQW
Ak7ttgKsjJO4Y4FDt2Egpx4dPW6ixhyqYIJs8wmVEGppTTPEjmrUmwyS9VymVQ1S
Se2xBjeitJr91CUmWkwsi6V9pTsuozjZTe0fwNHH7WNxFns8vEnV/yxACsE27MQ6
oieAln3u92EAl7MPgezo/1H4Y63Jh3ze0uJ1lCutrBISIFMmMfISW2/b2bb6QVQd
6RRm4wMotPzC0x4TF30NfDUoRVyiDU2dHe1L/G5dsbwV4Su7SaFwBzMMLAmMnWBq
6hTxB0kI0d2qXqGl0y9vLXddjC1Bz37Ka0x4c48m+2xp
-----END CERTIFICATE-----`

// Done TODO: Provide a URL that can be used to download a certificate that can be used
// to verify JWT token signature.
// To get this URL you need to go to an Auth0 page -> Show Advanced Settings -> Endpoints -> JSON Web Key Set
//const jwksUrl = 'https://dev-m3u5jaavo0wn16h5.us.auth0.com/.well-known/jwks.json'

export const handler = async (
  event: CustomAuthorizerEvent
): Promise<CustomAuthorizerResult> => {
  logger.info('Authorizing a user', event.authorizationToken)
  try {
    const jwtToken = await verifyToken(event.authorizationToken)
    logger.info('User was authorized', jwtToken)

    return {
      principalId: jwtToken.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: '*'
          }
        ]
      }
    }
  } catch (e) {
    logger.error('User not authorized', { error: e.message })

    return {
      principalId: 'user',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Deny',
            Resource: '*'
          }
        ]
      }
    }
  }
}

async function verifyToken(authHeader: string): Promise<JwtPayload> {
  const token = getToken(authHeader)
  return verify(token, cert, { algorithms: ['RS256'] }) as JwtPayload
}

function getToken(authHeader: string): string {
  if (!authHeader) throw new Error('No authentication header')

  if (!authHeader.toLowerCase().startsWith('bearer '))
    throw new Error('Invalid authentication header')

  const split = authHeader.split(' ')
  const token = split[1]

  return token
}
