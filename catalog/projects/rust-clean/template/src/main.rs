mod application;
mod domain;
mod infrastructure;

fn main() {
    infrastructure::console::print_greeting("world");
}
