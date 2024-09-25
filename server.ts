const localDatabase = new Map<string, any>();
const nextIds = new Map<string, number>(); // To track the next available ID for each path

// Operators for filtering
const operators:any = {
  '==': (a: any, b: any) => a == b,
  '<': (a: any, b: any) => a < b,
  '<=': (a: any, b: any) => a <= b,
  '>': (a: any, b: any) => a > b,
  '>=': (a: any, b: any) => a >= b,
  '!=': (a: any, b: any) => a != b,
};

// Helper function to save the local database to a JSON file
async function saveDatabaseToFile(filePath: string): Promise<void> {
  try {
    const jsonText = JSON.stringify(Object.fromEntries(localDatabase), null, 2);
    await Deno.writeTextFile(filePath, jsonText);
  } catch (error) {
    console.error("Error saving JSON file:", error);
  }
}

// Helper function to load the database from a JSON file
async function loadDatabaseFromFile(filePath: string): Promise<void> {
  try {
    const jsonText = await Deno.readTextFile(filePath);
    const dataMap = new Map(Object.entries(JSON.parse(jsonText)));

    for (const [key, value] of dataMap) {
      localDatabase.set(key, value);

      // Set nextId to the highest ID + 1 for each path
      if (Array.isArray(value)) {
        const maxId = value.reduce((max: number, item: any) => Math.max(max, item.Id || 0), 0);
        nextIds.set(key, maxId + 1); // Start the nextId from the highest existing Id + 1
      }
    }
  } catch (error) {
    console.error("Error reading JSON file:", error);
    Deno.exit(1);
  }
}

// Helper function to parse JSON body
async function parseJsonBody(req: Request): Promise<any> {
  try {
    const body = await req.json();
    return body;
  } catch {
    return null;
  }
}

// Helper function to apply filters (conditions)
function applyConditions(items: any[], query: URLSearchParams): any[] {


  const operatorRegex = /([><=!]=?|==)/;

  return items.filter(item => {
    for (const [key, value] of query.entries()) {
      const operatorMatch = key.match(operatorRegex);
      if (operatorMatch) {
        const operator = operatorMatch[0];
        const field = key.split(operator)[0];
        if (!(operator in operators) || !operators[operator](item[field], value)) {
          return false;
        }
      } else if (item[key] != value) {
        return false;
      }
    }
    return true;
  });
}

// Helper function to apply sorting
function applySorting(items: any[], query: URLSearchParams): any[] {
  const sortParam = query.get('_sort');
  if (!sortParam) return items;

  const fields = sortParam.split(',');
  return items.sort((a, b) => {
    for (const field of fields) {
      const desc = field.startsWith('-');
      const fieldName = desc ? field.slice(1) : field;
      const compare = desc ? -1 : 1;
      if (a[fieldName] > b[fieldName]) return compare;
      if (a[fieldName] < b[fieldName]) return -compare;
    }
    return 0;
  });
}

// Helper function to apply range (start, end, limit)
function applyRange(items: any[], query: URLSearchParams): any[] {
  const start = parseInt(query.get('_start') || '0', 10);
  const end = parseInt(query.get('_end') || items.length.toString(), 10);
  const limit = parseInt(query.get('_limit') || items.length.toString(), 10);

  return items.slice(start, end || limit);
}

// Helper function to apply pagination
function applyPagination(items: any[], query: URLSearchParams): any[] {
  const page = parseInt(query.get('_page') || '1', 10);
  const perPage = parseInt(query.get('_per_page') || '10', 10);
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

// Helper function to embed related data
function applyEmbed(items: any[], query: URLSearchParams, db: Map<string, any>): any[] {
  const embed = query.get('_embed');
  if (!embed) return items;

  return items.map(item => {
    const relatedData = db.get(embed)?.filter((relItem: any) => relItem.postId === item.Id);
    if (relatedData) {
      item[embed] = relatedData;
    }
    return item;
  });
}

// Function to handle GET requests
async function handleGet(pathSegments: string[], query: URLSearchParams): Promise<Response> {
  const [collection, id] = pathSegments;

  if (!collection) {
    // No collection provided, return entire database
    return new Response(JSON.stringify(Object.fromEntries(localDatabase)), { status: 200 });
  }

  let items = localDatabase.get(collection) || [];

  if (!id) {
    // Apply query-based filtering
    items = applyConditions(items, query);

    // Apply sorting
    items = applySorting(items, query);

    // Apply range or pagination
    if (query.has('_start') || query.has('_end') || query.has('_limit')) {
      items = applyRange(items, query);
    } else {
      items = applyPagination(items, query);
    }

    // Apply embed
    items = applyEmbed(items, query, localDatabase);

    return new Response(JSON.stringify(items), { status: 200 });
  }

  // If ID is provided, return the specific item
  const item = items.find((entry: any) => entry.Id === parseInt(id));

  if (item) {
    return new Response(JSON.stringify(item), { status: 200 });
  } else {
    return new Response(JSON.stringify({ message: "Item not found." }), { status: 404 });
  }
}

// Function to handle POST requests (append to array and assign new ID)
async function handlePost(pathSegments: string[], req: Request): Promise<Response> {
  if (pathSegments.length === 1) {
    const body = await parseJsonBody(req);
    if (body === null) {
      return new Response(JSON.stringify({ message: "Invalid JSON body." }), { status: 400 });
    }

    const key = pathSegments[0];
    let existingData = localDatabase.get(key);

    // Initialize as array if it doesn't exist
    if (!Array.isArray(existingData)) {
      existingData = [];
      localDatabase.set(key, existingData);
      nextIds.set(key, 1); // Initialize the next ID for this path
    }

    // Assign a new auto-incrementing ID for this path
    const objectId = nextIds.get(key) || 1;
    const newObject = { ...body, Id: objectId };

    // Increment the next ID counter for this path
    nextIds.set(key, objectId + 1);

    existingData.push(newObject);

    await saveDatabaseToFile(Deno.args[0]);
    return new Response(JSON.stringify({ message: "Appended", data: newObject }), { status: 201 });
  } else {
    return new Response(JSON.stringify({ message: "Invalid path for POST request." }), { status: 400 });
  }
}

// Function to route the requests based on method and URL
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathSegments = url.pathname.split("/").map(segment => segment.trim()).filter(Boolean);
  const query = url.searchParams;

  switch (req.method) {
    case "GET":
      return handleGet(pathSegments, query);
    case "POST":
      return handlePost(pathSegments, req);
    case "PUT":
    case "PATCH":
      return new Response(JSON.stringify({ message: "Not implemented." }), { status: 501 });
    case "DELETE":
      return new Response(JSON.stringify({ message: "Not implemented." }), { status: 501 });
    default:
      return new Response(JSON.stringify({ message: "Method not allowed" }), { status: 405 });
  }
}

// Load the database from file when starting the app
await loadDatabaseFromFile(Deno.args[0]);

// Start the Deno HTTP server
console.log("Server is running on http://localhost:8000");
Deno.serve({ port: 8000 }, handleRequest);
