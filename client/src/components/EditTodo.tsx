import * as React from 'react'
import { Form, Button } from 'semantic-ui-react'
import Auth from '../auth/Auth'
import { getUploadUrl, uploadFile, getUsers, shareTodo } from '../api/todos-api'
import {
  Checkbox,
  Divider,
  Grid,
  Header,
  Icon,
  Input,
  Image,
  Loader
} from 'semantic-ui-react'
import { User } from '../types/User'

enum UploadState {
  NoUpload,
  FetchingPresignedUrl,
  UploadingFile,
}

interface EditTodoProps {
  match: {
    params: {
      todoId: string
    }
  }
  auth: Auth
}

interface EditTodoState {
  file: any
  uploadState: UploadState
  users: User[]
}

export class EditTodo extends React.PureComponent<
  EditTodoProps,
  EditTodoState
> {
  state: EditTodoState = {
    file: undefined,
    uploadState: UploadState.NoUpload,
    users: []
  }

  handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    this.setState({
      file: files[0]
    })
  }

  handleSubmit = async (event: React.SyntheticEvent) => {
    event.preventDefault()

    try {
      if (!this.state.file) {
        alert('File should be selected')
        return
      }

      this.setUploadState(UploadState.FetchingPresignedUrl)
      const uploadUrl = await getUploadUrl(this.props.auth.getIdToken(), this.props.match.params.todoId)

      this.setUploadState(UploadState.UploadingFile)
      await uploadFile(uploadUrl, this.state.file)

      alert('File was uploaded!')
    } catch (e) {
      alert('Could not upload a file: ' + (e as Error).message)
    } finally {
      this.setUploadState(UploadState.NoUpload)
    }
  }

  setUploadState(uploadState: UploadState) {
    this.setState({
      uploadState
    })
  }

  async componentDidMount() {
    this.updateUsers()
  }

  async updateUsers() {
    try {
      const users = await getUsers(this.props.auth.getIdToken(), this.props.match.params.todoId)
      this.setState({
        file: undefined,
        uploadState: UploadState.NoUpload,
        users
      })
    } catch (e) {
      alert(`Failed to fetch users: ${(e as Error).message}`)
    }
  }

  render() {
    return (
      <div>
        <h1>Upload new image</h1>

        <Form onSubmit={this.handleSubmit}>
          <Form.Field>
            <label>File</label>
            <input
              type="file"
              accept="image/*"
              placeholder="Image to upload"
              onChange={this.handleFileChange}
            />
          </Form.Field>

          {this.renderButton()}
        </Form>

        <h1>Share with other users</h1>

        <Grid padded>
        {this.state.users.map((user, pos) => {
          return (
            <Grid.Row key={user.userId}>
              <Grid.Column width={1} verticalAlign="middle">
                <Checkbox
                  onChange={() => this.onTodoCheck(pos)}
                  checked={user.todoIds && user.todoIds[0] == this.props.match.params.todoId}
                />
              </Grid.Column>
              <Grid.Column width={10} verticalAlign="middle">
                {user.userId}
              </Grid.Column>
              {/* {todo.attachmentUrl && (
                <Image src={todo.attachmentUrl} size="small" wrapped />
              )} */}
              <Grid.Column width={16}>
                <Divider />
              </Grid.Column>
            </Grid.Row>
          )
        })}
      </Grid>

      </div>
    )
  }

  onTodoCheck = async (pos: number) => {
    try {
      const user = this.state.users[pos]
      await shareTodo(this.props.auth.getIdToken(), this.props.match.params.todoId , user.userId)
      this.setState({

      })
      this.updateUsers()
      this.render()
      // this.setState({
      //   todos: update(this.state.todos, {
      //     [pos]: { done: { $set: !todo.done } }
      //   })
      // })
    } catch {
      alert('Todo deletion failed')
    }
  }

  renderButton() {

    return (
      <div>
        {this.state.uploadState === UploadState.FetchingPresignedUrl && <p>Uploading image metadata</p>}
        {this.state.uploadState === UploadState.UploadingFile && <p>Uploading file</p>}
        <Button
          loading={this.state.uploadState !== UploadState.NoUpload}
          type="submit"
        >
          Upload
        </Button>
      </div>
    )
  }
}
