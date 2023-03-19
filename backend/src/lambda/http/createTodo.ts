import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import 'source-map-support/register'
import * as middy from 'middy'
import { cors, httpErrorHandler } from 'middy/middlewares'
import { CreateTodoRequest } from '../../requests/CreateTodoRequest'
import { getUserId } from '../utils';
import { createTodo } from '../../helpers/todos'
import { createLogger } from '../../utils/logger'

const logger = createLogger('auth')

export const handler = middy(
  async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    logger.info('Processing event: ', event)

    const userId = getUserId(event)
    const newTodoRequest: CreateTodoRequest = JSON.parse(event.body)
    let newTodoItem = await createTodo(userId, newTodoRequest)

    logger.info("created new todo item: " + JSON.stringify(newTodoItem))

    return {
      statusCode: 201,
      body: JSON.stringify({
        item: {
          ...newTodoItem
        }
      })
    }
  })

handler
  .use(httpErrorHandler())
  .use(cors({
    credentials: true
  })
)
