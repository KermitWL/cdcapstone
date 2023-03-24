import * as AWS from 'aws-sdk'
import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { createLogger } from '../utils/logger'
import { TodoItem } from '../models/TodoItem'
import { TodoUpdate } from '../models/TodoUpdate'
import { UserItem } from '../models/UserItem'

const AWSXRay = require('aws-xray-sdk')
const XAWS = AWSXRay.captureAWS(AWS)
const logger = createLogger('TodosAccess')

export class TodosAccess {
    constructor(
        private readonly docClient: DocumentClient = new XAWS.DynamoDB.DocumentClient(),
        private readonly todosTable: string = process.env.TODOS_TABLE,
        private readonly usersTable: string = process.env.USERS_TABLE,
        private readonly usersList: string = process.env.USERS_LIST,
        //private readonly todosByUserIndex = process.env.TODOS_CREATED_AT_INDEX,
        private readonly userKey: string = "USERKEY"
    ) {}
    
    async deleteTodo(todoId: string, userId: string) {
        logger.info('deleting todo ' + todoId + " for user " + userId)

        // get hold of item to be deleted
        const toDelete = await this.docClient.query({
            TableName: this.todosTable,
            KeyConditionExpression: "#todoId = :todoId",
            ExpressionAttributeNames: {
                "#todoId": "todoId"
            },
            ExpressionAttributeValues: {
                ":todoId": todoId
            }
        }).promise()

        logger.info('item to delete: ' + JSON.stringify(toDelete))

        if (toDelete.Items == undefined) {
            logger.error("item for todoId " + todoId + " not found")
            return
        }

        // get all owners of item and remove it
        for (const owner of toDelete.Items[0].owners) {
            // get user item for each owner

            const userParams = {
                TableName: this.usersTable,
                Key: {
                    userId: owner
                }
            }
            const result = await this.docClient.get(userParams).promise()
            if (result.Item == undefined) {
                logger.error("userId " + owner + " not found")
                return
            }
            logger.info("user " + JSON.stringify(result) + " is an owner of todoId " + todoId)

            // remove todoId from list
            let todoList: string[] = result.Item["todoIds"]
            const index = todoList.indexOf(todoId)
            if (index == -1) {
                logger.error("user " + owner + " should be owner of todoId " + todoId + ", but it was not found in todoIds list")
                return
            }
            todoList.splice(index, 1)

            // update user item with new list
            const updateParams = {
                TableName: this.usersTable,
                Key: {
                    userId: owner
                },
                UpdateExpression: 'set todoIds = :todoIds',
                ExpressionAttributeValues: {
                    ':todoIds': todoList
                }
            }
            await this.docClient.update(updateParams).promise()
        }
        
        const deleteParams = {
            TableName: this.todosTable,
            Key: {
                todoId,
                createdAt: toDelete.Items[0].createdAt
            }
        }

        logger.info('delete params: ' + JSON.stringify(deleteParams))

        // delete todo item
        await this.docClient.delete(deleteParams).promise();
    }

    async getTodo(todoId: string): Promise<TodoItem> {
        logger.info('Getting todo ' + todoId)

        const params = {
            TableName: this.todosTable,
            KeyConditionExpression: "#todoId = :todoId",
            ExpressionAttributeNames: {
                "#todoId": "todoId"
            },
            ExpressionAttributeValues: {
                ":todoId": todoId
            }
        };

        const result = await this.docClient.query(params).promise()
        const item = result.Items
        if (item == undefined) {
            logger.error("item id " + todoId + " not found!")
            return undefined
        }
        if (item.length > 1) {
            logger.error("item id " + todoId + " not unique!")
            return undefined
        }

        logger.info('received todo ' + JSON.stringify(item))

        return item[0] as TodoItem
    }

    async getAllTodosForUser(userId: string): Promise<TodoItem[]> {
        logger.info('Getting all Todos for user ' + userId)

        // first get todo ids for user

        try {
            var getTodoIdsForUserParams = {
                TableName: this.usersTable,
                Key: {
                    userId
                }
            }

            logger.info("starting query with params " + JSON.stringify(getTodoIdsForUserParams))

            const result = await this.docClient.get(getTodoIdsForUserParams).promise()
            logger.info("got raw todos " + JSON.stringify(result))
            let todoIdsForUser: TodoItem[] = [];

            if (result.Item != undefined) {
                const item = result.Item as UserItem
                logger.info("got todos " + JSON.stringify(item))

                // then get todoItems for the IDs

                for (const todoId of item.todoIds) {
                    let todoItem = await this.getTodo(todoId)
                    todoIdsForUser.push(todoItem)
                    logger.info("todosidsforuser now:\n" + JSON.stringify(todoIdsForUser))
                }
            }

            logger.info("all todos for user " + userId + ":\n" + JSON.stringify(todoIdsForUser))

            return todoIdsForUser as TodoItem[]

        } catch (error) {
            logger.error(error)
        }
    }

    async createTodo(newTodo: TodoItem): Promise<TodoItem> {
        logger.info('creating todo ' + JSON.stringify(newTodo))

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

    async getUserList(todoId: string): Promise<UserItem[]> {
        logger.info("getting user list with todoId " + todoId)
        const result = await this.docClient.get({
            TableName: this.usersList,
            Key: {
                key: this.userKey
            }
        }).promise()

        const userList = result.Item
        if (userList == undefined) {
            logger.error("error getting user list")
            return []
        }
        logger.info("user list: " + JSON.stringify(userList))

        // convert list from array of strings to array of JSON objects
        let returnList: UserItem[] = []
        userList["users"].forEach((element: string) => {
            // get user from UserTable, if user is ownder of todoId add it to return JSON object

            // add to return JSON object
            returnList.push({
                userId: element,
                todoIds: []
            })
        });

        logger.info("returning user list " + returnList)
        return returnList
    }
      
    async addUser(userId: string) {
        logger.info('adding new user ' + userId)

        const result = await this.docClient.get({
            TableName: this.usersList,
            Key: {
                key: this.userKey
            }
        }).promise()

        let newList = result.Item

        // first user
        if (newList == undefined) {
            newList = {
                key: this.userKey,
                users: []
            }
        }

        if (newList["users"].indexOf(userId) == -1) {
            newList["users"].push(userId)
        }

        await this.docClient.put({
            TableName: this.usersList,
            Item: newList
        }).promise()
    }

    async addTodoForUser(userId: string, todoId: string) {
        logger.info('adding todo ' + todoId + ' to user ' + userId)

        const user = await this.docClient.get({
            TableName: this.usersTable,
            Key: {
                userId
            }
        }).promise()

        let item = user.Item as UserItem
        // first todo for user
        if (item == undefined) {
            item = {
                userId,
                todoIds: []
            }
        }
        
        logger.info('user' + userId + ' previously owned ' + JSON.stringify(item))
        item.todoIds.push(todoId)
        logger.info('user' + userId + ' now owns ' + JSON.stringify(item))

        await this.docClient.put({
            TableName: this.usersTable,
            Item: item
        }).promise()
    }
}