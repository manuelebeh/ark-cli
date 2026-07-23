import { Text, StyleSheet } from "react-native";

type GreeterProps = {
  name?: string;
};

export function Greeter({ name = "world" }: GreeterProps) {
  return <Text style={styles.text}>{`Hello, ${name}`}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 24,
    padding: 24,
  },
});
