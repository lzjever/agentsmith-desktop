use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum MountLifecycleState {
    Idle,
    Activating,
    Active,
    Deactivating,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MountRecord {
    pub library_id: String,
    pub state: MountLifecycleState,
}

pub fn restore_mounts(active_library_ids: &[String]) -> Vec<MountRecord> {
    active_library_ids
        .iter()
        .map(|library_id| MountRecord {
            library_id: library_id.clone(),
            state: MountLifecycleState::Activating,
        })
        .collect()
}

pub fn stop_all_mounts(records: &[MountRecord]) -> Vec<MountRecord> {
    records
        .iter()
        .map(|record| MountRecord {
            library_id: record.library_id.clone(),
            state: MountLifecycleState::Deactivating,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{restore_mounts, stop_all_mounts, MountLifecycleState, MountRecord};

    #[test]
    fn restore_marks_active_libraries_as_activating() {
        let restored = restore_mounts(&["lib_1".into(), "lib_2".into()]);
        assert_eq!(restored.len(), 2);
        assert_eq!(restored[0].state, MountLifecycleState::Activating);
        assert_eq!(restored[1].library_id, "lib_2");
    }

    #[test]
    fn stop_all_marks_every_mount_as_deactivating() {
        let records = vec![
            MountRecord {
                library_id: "lib_1".into(),
                state: MountLifecycleState::Active,
            },
            MountRecord {
                library_id: "lib_2".into(),
                state: MountLifecycleState::Failed,
            },
        ];
        let stopped = stop_all_mounts(&records);
        assert!(stopped.iter().all(|record| record.state == MountLifecycleState::Deactivating));
    }
}
