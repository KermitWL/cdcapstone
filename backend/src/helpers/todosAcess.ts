import * as AWS from 'aws-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { createLogger } from '../utils/logger'
import { TodoItem } from '../models/TodoItem'
import { TodoUpdate } from '../models/TodoUpdate'

const AWSXRay = require('aws-xray-sdk')
const XAWS = AWSXRay.captureAWS(AWS)
const logger = createLogger('TodosAccess')

export class TodosAccess {
    constructor(
        private readonly docClient: DocumentClient = new XAWS.DynamoDB.DocumentClient(),
        private readonly todosTable: string = process.env.TODOS_TABLE,
        private readonly todosByUserIndex = process.env.TODOS_CREATED_AT_INDEX
    ) {}
    
    async deleteTodo(todoId: string, userId: string) {
        logger.info('deleting todo ' + todoId + " for user " + userId)

        const deleteParams = {
            TableName: this.todosTable,
            Key: {
                userId,
                todoId
            }
        }

        // const deleteParams = {
        //     TableName: this.todosTable,
        //     Key: {
        //         todoId,
        //         userId
        //     },
        //     ConditionExpression: "userId = :userId and todoId = :todoId",
        //     ExpressionAttributeValues: {
        //       ":todoId": todoId,
        //       ":userId": userId
        //     }
        //   }

        logger.info('delete params: ' + JSON.stringify(deleteParams))

        await this.docClient.delete(deleteParams).promise();
    }

    async getTodo(userId: string, todoId: string): Promise<TodoItem> {
        logger.info('Getting todo ' + todoId)

        const params = {
            TableName: this.todosTable,
            Key: {
                userId,
                todoId
            }
        };

        const result = await this.docClient.get(params).promise()
        const item = result.Item
        if (item == undefined) {
            logger.error("item id " + todoId + " not found!")
            return undefined
        }

        logger.info('received todo ' + JSON.stringify(item))

        return item as TodoItem
    }

    async getAllTodosForUser(userId: string): Promise<TodoItem[]> {
        logger.info('Getting all Todos for user ' + userId)
        
        try {
            var getAllTodosParams = {
                TableName: this.todosTable,
                IndexName: this.todosByUserIndex,
                KeyConditionExpression: 'userId = :userId',
                ExpressionAttributeValues: {
                    ':userId': userId
                }
            }
        
            logger.info("starting query with params " + JSON.stringify(getAllTodosParams))

            const result = await this.docClient.query(getAllTodosParams).promise()
            const items = result.Items

            logger.info("query returned " + items.length + " results")

            return items as TodoItem[]
        } catch (error) {
            logger.error(error)
        }
    }

    async createTodo(newTodo: TodoItem): Promise<TodoItem> {
        logger.info('creating todo ' + newTodo)

        await this.docClient.put({
            TableName: this.todosTable,
            Item: newTodo
        }).promise()
      
        return newTodo
    }
      
    async updateTodo(userId: string, todoId: string, todoUpdate: TodoUpdate) {
        logger.info('updating Todo ' + todoId)

        const updateParams = {
            TableName: this.todosTable,
            Key: {
                userId,
                todoId
            },
            UpdateExpression: 'set #name = :name, dueDate = :dueDate, done = :done',
            ExpressionAttributeNames: {
                '#name': 'name'
            },
            ExpressionAttributeValues: {
                ':name': todoUpdate.name,
                ':dueDate': todoUpdate.dueDate,
                ':done': todoUpdate.done
            }
        }

        await this.docClient.update(updateParams).promise()
      
        logger.info('Todo ' + todoId + ' was updated')
    }

    async updateAttachmentURL(userId: string, todoId: string, url: string) {
        logger.info('adding Attachment URL ' + url + ' to Todo ' + todoId)

        const updateParams = {
            TableName: this.todosTable,
            Key: {
                userId,
                todoId
            },
            UpdateExpression: 'set attachmentUrl = :attachmentUrl',
            ExpressionAttributeValues: {
                ':attachmentUrl': url
            }
        }
        await this.docClient.update(updateParams).promise()

        logger.info('Attachment URL ' + url + ' was added to Todo ' + todoId)
    }
      
}