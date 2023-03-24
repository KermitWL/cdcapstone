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
        private readonly userKey: string = "USERKEY"
    ) {}
    
    async deleteTodo(todoId: string, userId: string) {
        logger.info('deleting todo ' + todoId + " for user " + userId)

        // get hold of item to be deleted
        const toDelete = await this.getTodo(todoId)

        // get all owners of item and remove it from their todos list
        for (const owner of toDelete.owners) {
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
        
        // now delete todo item in todos table
        const deleteParams = {
            TableName: this.todosTable,
            Key: {
                todoId,
                createdAt: toDelete.createdAt
            }
        }

        logger.info('delete params: ' + JSON.stringify(deleteParams))

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


            let todoIdsForUser: TodoItem[] = [];
            // get all todo items owned by userId
            if (result.Item != undefined) {
                const item = result.Item as UserItem
                logger.info("got todos " + JSON.stringify(item))

                // then get todoItems for the IDs
                for (const todoId of item.todoIds) {
                    let todoItem = await this.getTodo(todoId)
                    todoIdsForUser.push(todoItem)
                }
            }

            logger.info("all todos for user " + userId + ":\n" + JSON.stringify(todoIdsForUser))

            return todoIdsForUser as TodoItem[]

        } catch (error) {
            logger.error(error)
        }
    }

    async createTodo(newTodo: TodoItem): Promise<TodoItem> {
        logger.info("creating todo " + JSON.stringify(newTodo))

        await this.docClient.put({
            TableName: this.todosTable,
            Item: newTodo
        }).promise()
      
        return newTodo
    }
      
    async updateTodo(userId: string, todoId: string, todoUpdate: TodoUpdate) {
        logger.info("updating Todo " + todoId + " for user " + userId)

        let item: TodoItem = await this.getTodo(todoId)

        const updateParams = {
            TableName: this.todosTable,
            Key: {
                todoId,
                createdAt: item.createdAt
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
      
        logger.info("Todo " + todoId + " was updated")
    }

    async updateAttachmentURL(userId: string, todoId: string, url: string) {
        logger.info("adding Attachment URL " + url + " to Todo " + todoId + " for user " + userId)

        let item: TodoItem = await this.getTodo(todoId)
        
        const updateParams = {
            TableName: this.todosTable,
            Key: {
                todoId,
                createdAt: item.createdAt
            },
            UpdateExpression: 'set attachmentUrl = :attachmentUrl',
            ExpressionAttributeValues: {
                ':attachmentUrl': url
            }
        }
        await this.docClient.update(updateParams).promise()

        logger.info("Attachment URL " + url + " was added to Todo " + todoId)
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

        for (const user of userList["users"]) {
            // get user from UserTable, if user is owner of todoId add it to list
            let todoIds = []
            if (await this.isOwner(user, todoId)) {
                todoIds.push(todoId)
            }
            // add list to return JSON object
            returnList.push({
                userId: user,
                todoIds
            })
        }

        logger.info("returning user list " + returnList)
        return returnList
    }

    async isOwner(userId: string, todoId: string): Promise<boolean> {
        let item: TodoItem = await this.getTodo(todoId)
        return item.owners.includes(userId);
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

        // first user in system
        if (newList == undefined) {
            newList = {
                key: this.userKey,
                users: []
            }
        }

        // if user is unknown so far, add it to list
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
        
        item.todoIds.push(todoId)
        
        await this.docClient.put({
            TableName: this.usersTable,
            Item: item
        }).promise()
    }

    async toggleSharing(todoId: string, userId: string): Promise <boolean> {
        logger.info("toggling sharing for todo " + todoId + " for user " + userId)

        // adapt owners in todo
        let item = await this.getTodo(todoId)
        if (item.owners.includes(userId)) {
            item.owners.splice(item.owners.indexOf(userId), 1)
            logger.info("removing " + userId + " from owner list for todo " + todoId)
        } else {
            item.owners.push(userId)
            logger.info("adding " + userId + " to owner list for todo " + todoId)
        }

        const updateTodoParams = {
            TableName: this.todosTable,
            Key: {
                todoId,
                createdAt: item.createdAt
            },
            UpdateExpression: 'set #owners = :owners',
            ExpressionAttributeNames: {
                '#owners': 'owners'
            },
            ExpressionAttributeValues: {
                ':owners': item.owners
            }
        }

        await this.docClient.update(updateTodoParams).promise()

        // adapt todoIds in user
        logger.info("toggling " + todoId + " from todoId list for user " + userId)
        const userParams = {
            TableName: this.usersTable,
            Key: {
                userId
            }
        }
        logger.info("userfind params: " + JSON.stringify(userParams))

        const result = await this.docClient.get(userParams).promise()
        logger.info("found user: " + JSON.stringify(result))
        if (result.Item == undefined) {
            logger.error("userId " + userId + " not found")
            return false
        }
        
        // toggle sharing todoId from list
        let todoList: string[] = result.Item["todoIds"]
        const index = todoList.indexOf(todoId)
        if (index == -1) {
            todoList.push(todoId)
            logger.info("adding " + todoId + " from todoId list for user " + userId)
        } else {
            todoList.splice(index, 1)
            logger.info("removing " + todoId + " from todoId list for user " + userId)
        }
        
        const updateUserParams = {
            TableName: this.usersTable,
            Key: {
                userId
            },
            UpdateExpression: 'set todoIds = :todoIds',
            ExpressionAttributeValues: {
                ':todoIds': todoList
            }
        }
        await this.docClient.update(updateUserParams).promise()

        return true
    }
}