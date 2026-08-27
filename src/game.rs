use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum Phase {
    Lobby,
    Playing,
    Won,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomGame {
    pub kind: String,
    pub phase: Phase,
    pub turn: u8,
    pub round: u16,
    pub moves: u16,
    pub board: Value,
    pub message: String,
}

impl Default for RoomGame {
    fn default() -> Self {
        Self {
            kind: "lobby".into(),
            phase: Phase::Lobby,
            turn: 0,
            round: 0,
            moves: 0,
            board: json!({}),
            message: "Choose a game when both windows are lit.".into(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct MoveInput {
    pub action: String,
    #[serde(default)]
    pub value: Value,
}

pub fn start(kind: &str, round: u16) -> Result<RoomGame, String> {
    let seed = round as usize;
    match kind {
        "star_signal" => {
            let maps = [
                ["moon", "drop", "leaf", "star", "sun", "heart"],
                ["leaf", "star", "moon", "heart", "drop", "sun"],
                ["sun", "heart", "star", "drop", "moon", "leaf"],
                ["drop", "moon", "sun", "leaf", "heart", "star"],
            ];
            Ok(RoomGame {
                kind: kind.into(),
                phase: Phase::Playing,
                turn: 0,
                round,
                moves: 0,
                board: json!({ "sequence": maps[seed % maps.len()], "progress": 0, "misses": 0 }),
                message: "Window A sends the first symbol.".into(),
            })
        }
        "patchwork" => {
            let patterns = [
                [
                    "mint", "sky", "mint", "sky", "amber", "sky", "mint", "sky", "mint",
                ],
                [
                    "amber", "sky", "mint", "mint", "amber", "sky", "sky", "mint", "amber",
                ],
                [
                    "sky", "mint", "amber", "amber", "sky", "mint", "mint", "amber", "sky",
                ],
            ];
            Ok(RoomGame {
                kind: kind.into(),
                phase: Phase::Playing,
                turn: 0,
                round,
                moves: 0,
                board: json!({ "target": patterns[seed % patterns.len()], "placed": [null,null,null,null,null,null,null,null,null] }),
                message: "Window A places the first patch.".into(),
            })
        }
        "firefly_ferry" => {
            let layouts = [
                (0, 24, vec![2, 4, 10, 16, 22]),
                (20, 4, vec![0, 6, 11, 18, 23]),
                (4, 20, vec![1, 5, 9, 13, 17]),
            ];
            let (position, goal, rocks) = layouts[seed % layouts.len()].clone();
            Ok(RoomGame {
                kind: kind.into(),
                phase: Phase::Playing,
                turn: 0,
                round,
                moves: 0,
                board: json!({ "start": position, "position": position, "goal": goal, "rocks": rocks, "energy": 14 }),
                message: "Window A moves sideways; Window B moves up or down.".into(),
            })
        }
        _ => Err("That game is not available.".into()),
    }
}

pub fn apply(game: &mut RoomGame, seat: u8, input: &MoveInput) -> Result<(), String> {
    if game.phase != Phase::Playing {
        return Err("This round is not taking moves.".into());
    }
    if game.turn != seat {
        return Err("It is your partner's turn.".into());
    }
    match game.kind.as_str() {
        "star_signal" => star_signal(game, input),
        "patchwork" => patchwork(game, seat, input),
        "firefly_ferry" => firefly(game, seat, input),
        _ => Err("Choose a game first.".into()),
    }
}

fn star_signal(game: &mut RoomGame, input: &MoveInput) -> Result<(), String> {
    if input.action != "choose_symbol" {
        return Err("That move does not fit this game.".into());
    }
    let selected = input.value.as_str().ok_or("Choose a symbol.")?;
    let progress = game.board["progress"].as_u64().unwrap_or(0) as usize;
    let (correct, sequence_len) = {
        let sequence = game.board["sequence"]
            .as_array()
            .ok_or("Round data is incomplete.")?;
        (
            sequence.get(progress).and_then(Value::as_str) == Some(selected),
            sequence.len(),
        )
    };
    game.moves += 1;
    if correct {
        let next = progress + 1;
        game.board["progress"] = json!(next);
        if next == sequence_len {
            game.phase = Phase::Won;
            game.message = format!("Signal complete in {} turns!", game.moves);
            return Ok(());
        }
        game.turn = 1 - game.turn;
        game.message = format!(
            "Correct. Window {} sends the next symbol.",
            if game.turn == 0 { "A" } else { "B" }
        );
    } else {
        let misses = game.board["misses"].as_u64().unwrap_or(0) + 1;
        game.board["misses"] = json!(misses);
        game.message = "That symbol fizzled. Try the same step again together.".into();
    }
    Ok(())
}

fn patchwork(game: &mut RoomGame, seat: u8, input: &MoveInput) -> Result<(), String> {
    if input.action != "place_patch" {
        return Err("That move does not fit this game.".into());
    }
    let index = input.value["index"]
        .as_u64()
        .ok_or("Choose an empty square.")? as usize;
    let color = input.value["color"]
        .as_str()
        .ok_or("Choose a patch color.")?;
    if index >= 9 || !["mint", "sky", "amber"].contains(&color) {
        return Err("That patch is outside the quilt.".into());
    }
    let target = game.board["target"][index]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    if target != color {
        return Err("That color does not match this square's stitched edge.".into());
    }
    let placed = game.board["placed"]
        .as_array_mut()
        .ok_or("Round data is incomplete.")?;
    if !placed[index].is_null() {
        return Err("That square already has a patch.".into());
    }
    placed[index] = json!(color);
    game.moves += 1;
    if placed.iter().all(|v| !v.is_null()) {
        game.phase = Phase::Won;
        game.message = "The shared patchwork is complete!".into();
    } else {
        game.turn = 1 - seat;
        game.message = format!(
            "Patch placed. Window {} chooses next.",
            if game.turn == 0 { "A" } else { "B" }
        );
    }
    Ok(())
}

fn firefly(game: &mut RoomGame, seat: u8, input: &MoveInput) -> Result<(), String> {
    if input.action != "move_firefly" {
        return Err("That move does not fit this game.".into());
    }
    let direction = input.value.as_str().ok_or("Choose a direction.")?;
    let position = game.board["position"].as_i64().unwrap_or(0);
    let row = position / 5;
    let col = position % 5;
    let next = match (seat, direction) {
        (0, "left") if col > 0 => position - 1,
        (0, "right") if col < 4 => position + 1,
        (1, "up") if row > 0 => position - 5,
        (1, "down") if row < 4 => position + 5,
        (0, _) => return Err("Window A can move only left or right.".into()),
        _ => return Err("Window B can move only up or down.".into()),
    };
    let rocks = game.board["rocks"]
        .as_array()
        .ok_or("Round data is incomplete.")?;
    if rocks.iter().any(|r| r.as_i64() == Some(next)) {
        return Err("A river stone blocks that way.".into());
    }
    game.board["position"] = json!(next);
    let energy = game.board["energy"].as_u64().unwrap_or(1).saturating_sub(1);
    game.board["energy"] = json!(energy);
    game.moves += 1;
    if game.board["goal"].as_i64() == Some(next) {
        game.phase = Phase::Won;
        game.message = format!("The firefly reached home with {} lights left!", energy);
    } else if energy == 0 {
        // Keep this family activity forgiving: reset the firefly rather than ending the room.
        game.board["position"] = game.board["start"].clone();
        game.board["energy"] = json!(14);
        game.message =
            "The lantern dimmed, so it floated back to the start. Try a new route.".into();
    } else {
        game.turn = 1 - seat;
        game.message = format!(
            "Safe crossing. Window {} moves next.",
            if game.turn == 0 { "A" } else { "B" }
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_a_move_from_the_wrong_window() {
        let mut game = start("star_signal", 1).unwrap();
        let result = apply(
            &mut game,
            1,
            &MoveInput {
                action: "choose_symbol".into(),
                value: json!("moon"),
            },
        );
        assert!(result.unwrap_err().contains("partner"));
    }

    #[test]
    fn patchwork_accepts_a_matching_patch() {
        let mut game = start("patchwork", 0).unwrap();
        let color = game.board["target"][0].as_str().unwrap().to_owned();
        apply(
            &mut game,
            0,
            &MoveInput {
                action: "place_patch".into(),
                value: json!({"index": 0, "color": color}),
            },
        )
        .unwrap();
        assert_eq!(game.moves, 1);
        assert_eq!(game.turn, 1);
    }
}
