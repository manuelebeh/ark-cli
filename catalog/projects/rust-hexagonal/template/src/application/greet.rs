use crate::domain::greeting::Greeting;

pub fn greet(name: &str) -> Greeting {
    Greeting {
        text: format!("Hello, {}", name),
    }
}
