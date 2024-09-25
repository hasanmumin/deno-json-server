# JSON Server API with Deno 2.0 Release Candidate

A simple JSON server built using Deno with support for filtering, pagination, sorting, range queries, and embedded resources. The server allows you to retrieve and manipulate JSON data stored in a file, providing an interface for GET, POST requests, and query-based filtering.

## Features

- **Conditions** (`==`, `!=`, `<`, `<=`, `>`, `>=`)
- **Range** (`_start`, `_end`, `_limit`)
- **Pagination** (`_page`, `_per_page`)
- **Sorting** (`_sort`)
- **Nested and Array Fields** (e.g., `x.y`, `arr[0]`)
- **Embedded Resources** (`_embed`)

## Requirements

- [Deno 2.0 Release Candidate](https://deno.com/blog/v2.0-release-candidate) installed

## Usage

### Start the Server

```bash
deno run dev data.json
```

- `--allow-read`: Grants permission to read the JSON file.
- `--allow-write`: Grants permission to write changes to the JSON file.
- `--allow-net`: Grants permission for the server to listen on a network port.

### Data Format

The data file (`data.json`) should be a simple JSON file with collections. Example:

```json
{
  "posts": [
    { "Id": 1, "title": "First Post", "views": 1000 }
  ],
  "comments": [
    { "Id": 1, "body": "Great post!", "postId": 1 }
  ]
}
```

### Query Examples

#### 1. **Filtering with Conditions**

Supports filtering with conditions like `==`, `!=`, `<`, `<=`, `>`, `>=`.

```bash
GET /posts?views>=1000
```

Will return all posts with `views` greater than or equal to 1000.

```bash
GET /posts?views!=500
```

Will return all posts where `views` is not equal to 500.

#### 2. **Range Queries**

Supports retrieving a specific range of data using `_start`, `_end`, or `_limit`.

```bash
GET /posts?_start=0&_end=10
```

Will return posts from index 0 to 10.

```bash
GET /posts?_limit=5
```

Will return the first 5 posts.

#### 3. **Pagination**

Supports paginated requests with `_page` and `_per_page`.

```bash
GET /posts?_page=1&_per_page=10
```

Will return 10 posts on the first page.

#### 4. **Sorting**

Supports sorting on multiple fields. Use `-` for descending order.

```bash
GET /posts?_sort=Id,-views
```

Will return posts sorted by `Id` in ascending order and `views` in descending order.

#### 5. **Nested and Array Fields**

You can filter nested fields and array fields.

```bash
GET /posts?author.name==John
```

Will return posts where the author's name is "John".

```bash
GET /posts?tags[0]==tech
```

Will return posts where the first tag in the `tags` array is "tech".

#### 6. **Embedding Resources**

You can embed related resources in the response using `_embed`.

```bash
GET /posts?_embed=comments
```

Will return posts along with their related comments.

```bash
GET /comments?_embed=posts
```

Will return comments along with their related posts.

### POST Requests

To add new data to a collection:

```bash
POST /posts
Content-Type: application/json

{
  "title": "New Post",
  "views": 100
}
```

This will append a new post to the `posts` collection and automatically assign it an auto-incrementing `Id`.

## License

This project is licensed under the MIT License.
