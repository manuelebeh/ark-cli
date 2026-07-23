use crate::application::greet::greet;

pub fn print_greeting(name: &str) {
    let greeting = greet(name);
    println!("{}", greeting.text);
}
