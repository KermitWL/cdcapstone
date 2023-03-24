import 'source-map-support/register'

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as middy from 'middy'
import { cors } from 'middy/middlewares'
import { createLogger } from '../../utils/logger'
import { toggleSharing } from '../../helpers/todos'

const logger = createLogger('http shareTodos')

export const handler = middy(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    logger.info('Processing event: ', event)

    const todoId: string = event.pathParameters.todoId
    const body = JSON.parse(event.body)
    const userId = body["userId"]
    
    logger.info("sharing todo " + todoId + " with user " + userId)

    const result = await toggleSharing(todoId, userId)

    if (result) {
        return {
            statusCode: 200,
            body: ""
        }
    } else {
        return {
            statusCode: 400,
            body: ""
        }
    }
  })

handler.use(
  cors({
    credentials: true
  })
)
