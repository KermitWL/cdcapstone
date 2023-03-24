import 'source-map-support/register'

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as middy from 'middy'
import { cors } from 'middy/middlewares'
import { getUserList as getUserList } from '../../helpers/todos'
import { getUserId } from '../utils';
import { createLogger } from '../../utils/logger'

const logger = createLogger('http getUsers')

export const handler = middy(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    logger.info('Processing event: ', event)

    const userId = getUserId(event)
    const todoId = event.pathParameters.todoId
    
    logger.info("getting User list for user " + userId + " with todoId " + todoId)

    const users = await getUserList(todoId)
    
    logger.info("returning User list " + JSON.stringify(users))

    return {
      statusCode: 200,
      body: JSON.stringify({
        items: users
      })
    }
  })

handler.use(
  cors({
    credentials: true
  })
)
