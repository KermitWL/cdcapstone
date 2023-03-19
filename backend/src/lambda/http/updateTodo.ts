import 'source-map-support/register'

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import * as middy from 'middy'
import { cors, httpErrorHandler } from 'middy/middlewares'
import { updateTodo } from '../../helpers/todos'
import { UpdateTodoRequest } from '../../requests/UpdateTodoRequest'
import { getUserId } from '../utils'
import { createLogger } from '../../utils/logger'

const logger = createLogger('auth')

export const handler = middy(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    logger.info('Processing event: ', event)
    
    const todoId = event.pathParameters.todoId
    const updatedTodo: UpdateTodoRequest = JSON.parse(event.body)
    const userId = getUserId(event)
    
    logger.info("updating todo item " + todoId + " for user " + userId + " with content " + JSON.stringify(updatedTodo))
    
    const updatedTodoItem = updateTodo(userId, todoId, updatedTodo)
    if (updatedTodoItem == undefined) {
      return {
        statusCode: 403,
        body: "item update failed"
      }
    }
    
    logger.info("updated item contents: " + JSON.stringify(updatedTodoItem))

    return {
      statusCode: 200,
      body: ""
    }
  }
)

handler
  .use(httpErrorHandler())
  .use(
    cors({
      credentials: true
    })
  )
