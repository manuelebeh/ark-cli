mod adapters;
mod application;
mod domain;

fn main() {
    adapters::console::print_greeting("world");
}
