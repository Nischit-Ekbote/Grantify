use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use actix_cors::Cors;
use mongodb::{Client, Collection, bson::doc};
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Task {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    id: Option<mongodb::bson::oid::ObjectId>,
    #[serde(rename = "taskId")]
    task_id: String,
    text: String,
    column: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct TasksResponse {
    todo: Vec<Task>,
    active: Vec<Task>,
    completed: Vec<Task>,
}

#[derive(Debug, Deserialize)]
struct CreateTaskRequest {
    text: String,
}

#[derive(Debug, Deserialize)]
struct UpdateTaskRequest {
    text: Option<String>,
    column: Option<String>,
}

struct AppState {
    tasks_collection: Collection<Task>,
}

async fn get_tasks(data: web::Data<AppState>) -> impl Responder {
    let collection = &data.tasks_collection;
    
    match collection.find(None, None).await {
        Ok(mut cursor) => {
            let mut tasks = TasksResponse {
                todo: Vec::new(),
                active: Vec::new(),
                completed: Vec::new(),
            };
            
            use futures::stream::StreamExt;
            while let Some(result) = cursor.next().await {
                match result {
                    Ok(task) => {
                        match task.column.as_str() {
                            "todo" => tasks.todo.push(task),
                            "active" => tasks.active.push(task),
                            "completed" => tasks.completed.push(task),
                            _ => {}
                        }
                    }
                    Err(e) => {
                        eprintln!("Error reading task: {}", e);
                    }
                }
            }
            
            HttpResponse::Ok().json(tasks)
        }
        Err(e) => {
            eprintln!("Error fetching tasks: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to fetch tasks"
            }))
        }
    }
}

async fn create_task(
    data: web::Data<AppState>,
    task_data: web::Json<CreateTaskRequest>,
) -> impl Responder {
    let collection = &data.tasks_collection;
    
    let new_task = Task {
        id: None,
        task_id: format!("task-{}", chrono::Utc::now().timestamp_millis()),
        text: task_data.text.clone(),
        column: "todo".to_string(),
    };
    
    match collection.insert_one(new_task.clone(), None).await {
        Ok(_) => HttpResponse::Created().json(new_task),
        Err(e) => {
            eprintln!("Error creating task: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to create task"
            }))
        }
    }
}

async fn update_task(
    data: web::Data<AppState>,
    task_id: web::Path<String>,
    task_data: web::Json<UpdateTaskRequest>,
) -> impl Responder {
    let collection = &data.tasks_collection;
    
    let filter = doc! { "taskId": task_id.as_str() };
    
    let mut update_doc = doc! {};
    if let Some(text) = &task_data.text {
        update_doc.insert("text", text);
    }
    if let Some(column) = &task_data.column {
        update_doc.insert("column", column);
    }
    
    if update_doc.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "No fields to update"
        }));
    }
    
    let update = doc! { "$set": update_doc };
    
    match collection.update_one(filter.clone(), update, None).await {
        Ok(result) => {
            if result.matched_count == 0 {
                HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Task not found"
                }))
            } else {
                match collection.find_one(filter, None).await {
                    Ok(Some(task)) => HttpResponse::Ok().json(task),
                    Ok(None) => HttpResponse::NotFound().json(serde_json::json!({
                        "error": "Task not found after update"
                    })),
                    Err(e) => {
                        eprintln!("Error fetching updated task: {}", e);
                        HttpResponse::InternalServerError().json(serde_json::json!({
                            "error": "Failed to fetch updated task"
                        }))
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("Error updating task: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to update task"
            }))
        }
    }
}

async fn delete_task(
    data: web::Data<AppState>,
    task_id: web::Path<String>,
) -> impl Responder {
    let collection = &data.tasks_collection;
    
    let filter = doc! { "taskId": task_id.as_str() };
    
    match collection.delete_one(filter, None).await {
        Ok(result) => {
            if result.deleted_count == 0 {
                HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Task not found"
                }))
            } else {
                HttpResponse::Ok().json(serde_json::json!({
                    "message": "Task deleted successfully"
                }))
            }
        }
        Err(e) => {
            eprintln!("Error deleting task: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to delete task"
            }))
        }
    }
}

async fn health_check() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({
        "status": "healthy",
        "service": "kanban-backend"
    }))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv::dotenv().ok();
    
    let mongodb_uri = env::var("MONGODB_URI")
        .unwrap_or_else(|_| "mongodb://localhost:27017".to_string());
    let database_name = env::var("DATABASE_NAME")
        .unwrap_or_else(|_| "kanban_db".to_string());
    let port = env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()
        .expect("PORT must be a valid number");
    
    println!("Connecting to MongoDB at: {}", mongodb_uri);
    
    let client = Client::with_uri_str(&mongodb_uri)
        .await
        .expect("Failed to connect to MongoDB");
    
    let database = client.database(&database_name);
    let tasks_collection: Collection<Task> = database.collection("tasks");
    
    println!("Connected to MongoDB successfully!");
    
    let app_state = web::Data::new(AppState {
        tasks_collection,
    });
    
    println!("Starting server on port {}...", port);
    
    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .max_age(3600);
        
        App::new()
            .wrap(cors)
            .app_data(app_state.clone())
            .route("/health", web::get().to(health_check))
            .route("/api/tasks", web::get().to(get_tasks))
            .route("/api/tasks", web::post().to(create_task))
            .route("/api/tasks/{id}", web::put().to(update_task))
            .route("/api/tasks/{id}", web::delete().to(delete_task))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}