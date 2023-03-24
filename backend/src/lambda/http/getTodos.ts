import 'source-map-support/register'

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as middy from 'middy'
import { cors } from 'middy/middlewares'
import { getTodosForUser as getTodosForUser } from '../../businessLogic/todos'
import { getUserId } from '../utils';
import { createLogger } from '../../utils/logger'

const logger = createLogger('http getTodos')

export const handler = middy(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    logger.info('Processing event: ', event)

    const userId = getUserId(event)
    
    logger.info("getting Todos for user " + userId)

    const todos = await getTodosForUser(userId)
    logger.info("returning todo list " + JSON.stringify(todos))

    if (todos == undefined) {
      return {
        statusCode: 500,
        body: ""
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        items: todos
      })
    }
  })

handler.use(
  cors({
    credentials: true
  })
)
