import { TodosAccess } from '../dataLayer/todosAcess'
import { AttachmentUtils } from '../helpers/attachmentUtils';
import { TodoItem } from '../models/TodoItem'
import { CreateTodoRequest } from '../requests/CreateTodoRequest'
import { UpdateTodoRequest } from '../requests/UpdateTodoRequest'
import { createLogger } from '../utils/logger'
import * as uuid from 'uuid'
import { TodoUpdate } from '../models/TodoUpdate';
import { UserItem } from '../models/UserItem';

const todosAccess = new TodosAccess()
const attachmentUtils = new AttachmentUtils()
const logger = createLogger('Todos Business Logic')

export async function getTodosForUser(userId: string): Promise<TodoItem[]> {
    logger.info("getting Todos for user " + userId)
    return await todosAccess.getAllTodosForUser(userId)
}

export async function getUserList(todoId: string): Promise<UserItem[]> {
    logger.info("getting User list")
    return await todosAccess.getUserList(todoId)
}

export async function toggleSharing(todoId: string, userId: string): Promise<boolean> {
    logger.info("sharing todo " + todoId + " with user " + userId)
    return await todosAccess.toggleSharing(todoId, userId)
}

export async function createTodo(userId: string, request: CreateTodoRequest): Promise<TodoItem> {
    logger.info("creating new Todo for user: " + userId + " with content " + JSON.stringify(request))

    const todoId = uuid.v4()

    // store new user
    await todosAccess.addUser(userId)

    // add todo for user
    await todosAccess.addTodoForUser(userId, todoId)

    const newItem: TodoItem = {
        "todoId": todoId,
        "createdAt": new Date().toISOString(),
        "name": request.name,
        "dueDate": request.dueDate,
        "done": false,
        "owners": [userId],
        "attachmentUrl": undefined
    }

    return await todosAccess.createTodo(newItem)
}

export async function updateTodo(userId: string, todoId: string, request: UpdateTodoRequest): Promise<TodoItem> {
    logger.info("updateing Todo item " + todoId + " for user: " + userId + " with content " + JSON.stringify(request))
    
    if (!doesItemBelongToUser(todoId, userId)) {
        logger.error("todo item " + todoId + " does NOT belong to user " + userId)
        return undefined
    }

    await todosAccess.updateTodo(userId, todoId, request as TodoUpdate)
}

export async function deleteTodo(todoId: string, userId: string) {
    logger.info("deleting todo " + todoId)

    if (!doesItemBelongToUser(todoId, userId)) {
        logger.error("todo item " + todoId + " does NOT belong to user " + userId)
        return undefined
    }

    return todosAccess.deleteTodo(todoId, userId)
}

export async function createAttachmentPresignedUrlAndUpdateItem(todoId: string, userId: string): Promise<string> {
    logger.info("getting upload URL for todo " + todoId)

    if (!doesItemBelongToUser(todoId, userId)) {
        logger.error("todo item " + todoId + " does not belong to user " + userId)
        return undefined
    }

    const url: string = await attachmentUtils.getUploadURL(todoId)
    logger.info("presigned url generated: " + url)
    todosAccess.updateAttachmentURL(userId, todoId, url.split("?")[0])

    return url
}

async function doesItemBelongToUser(todoId: string, userId: string): Promise<boolean> {
    logger.info("checking if todo item " + todoId + " belongs to user " + userId)

    const item: TodoItem = await todosAccess.getTodo(todoId)
    if (item == undefined) {
        logger.error("error getting todo item " + todoId)
        return false
    }

    logger.info("todo item " + todoId + " belongs to user " + userId)

    return item.owners.includes(userId)
}
