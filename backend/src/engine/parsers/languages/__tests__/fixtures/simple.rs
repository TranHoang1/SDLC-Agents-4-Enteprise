use std::collections::HashMap;
use std::io::{self, Read, Write};
use crate::config::Settings;

pub const MAX_CONNECTIONS: u32 = 100;
static INSTANCE_COUNT: u32 = 0;

/// A connection pool for managing database connections
#[derive(Debug, Clone)]
pub struct ConnectionPool<T: Connection> {
    connections: Vec<T>,
    max_size: usize,
    name: String,
}

/// Represents possible pool errors
#[derive(Debug)]
pub enum PoolError {
    Exhausted,
    Timeout(u64),
    ConnectionFailed(String),
}

/// Trait for database connections
pub trait Connection {
    fn connect(&mut self) -> Result<(), PoolError>;
    fn disconnect(&mut self);
    fn is_alive(&self) -> bool;
}

/// Trait for queryable connections
pub trait Queryable: Connection {
    async fn execute(&self, query: &str) -> Result<Vec<u8>, PoolError>;
}

impl<T: Connection> ConnectionPool<T> {
    pub fn new(max_size: usize, name: String) -> Self {
        Self {
            connections: Vec::new(),
            max_size,
            name,
        }
    }

    pub async fn acquire(&mut self) -> Result<&T, PoolError> {
        if self.connections.is_empty() {
            return Err(PoolError::Exhausted);
        }
        Ok(&self.connections[0])
    }

    fn cleanup(&mut self) {
        self.connections.retain(|c| c.is_alive());
    }
}

impl Connection for PgConnection {
    fn connect(&mut self) -> Result<(), PoolError> {
        println!("Connecting to PostgreSQL...");
        Ok(())
    }

    fn disconnect(&mut self) {
        println!("Disconnecting...");
    }

    fn is_alive(&self) -> bool {
        true
    }
}

pub struct PgConnection {
    host: String,
    port: u16,
}

mod tests {
    use super::*;

    fn setup() -> ConnectionPool<PgConnection> {
        ConnectionPool::new(10, "test_pool".to_string())
    }
}

macro_rules! retry {
    ($expr:expr, $max:expr) => {
        {
            let mut attempts = 0;
            loop {
                match $expr {
                    Ok(val) => break Ok(val),
                    Err(e) if attempts < $max => attempts += 1,
                    Err(e) => break Err(e),
                }
            }
        }
    };
}

pub unsafe fn raw_allocate(size: usize) -> *mut u8 {
    std::alloc::alloc(std::alloc::Layout::from_size_align_unchecked(size, 8))
}

pub async fn fetch_data(url: &str) -> Result<Vec<u8>, PoolError> {
    let client = HttpClient::new();
    let response = client.get(url).await;
    println!("Fetched {} bytes", response.len());
    Ok(response)
}
