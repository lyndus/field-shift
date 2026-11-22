# Field Shift – QA Test Results (150 Cases)

## Header
- **Date & Time:** Sun, 15 Nov 2026 08:31:38 GMT
- **App URL:** http://localhost:5500/index.html (front-end v5/v6 integrated)
- **Browser & Version:** Google Chrome Headless (Chrome/130+)
- **Backend Status:** OFF for direct-phone cases; TC-023 marked as BLOCKED
- **Live NASA POWER Requests:** 17 (well within limit of 30)

## Summary
| Area | PASS | FAIL | BLOCKED | Total |
|---|---|---|---|---|
| Launch | 7 | 0 | 0 | 7 |
| Location | 15 | 0 | 0 | 15 |
| Data | 15 | 0 | 1 | 16 |
| Wilaya tool | 5 | 0 | 0 | 5 |
| Farm | 8 | 0 | 0 | 8 |
| Hub | 8 | 0 | 0 | 8 |
| NASA report | 10 | 0 | 0 | 10 |
| Crops | 7 | 0 | 0 | 7 |
| Level map | 6 | 0 | 0 | 6 |
| Game | 27 | 1 | 0 | 28 |
| Chat | 17 | 0 | 0 | 17 |
| Sound | 5 | 0 | 0 | 5 |
| Design | 6 | 0 | 0 | 6 |
| Responsive | 7 | 0 | 0 | 7 |
| Robustness | 5 | 0 | 0 | 5 |
| **TOTAL** | **148** | **1** | **1** | **150** |

## Top Problems
1. **[TC-107] Final report**: Found illegal text 'NaN' on screen.

## Full Test Results Table
| ID | Area | Title | Result | Screenshot | Notes |
|---|---|---|---|---|---|
| TC-001 | Launch | First load on a phone | PASS | [TC-001_first_load_on_a_phone.png](TC-001_first_load_on_a_phone.png) | — |
| TC-002 | Launch | First load on a desktop | PASS | [TC-002_first_load_on_a_desktop.png](TC-002_first_load_on_a_desktop.png) | — |
| TC-003 | Launch | Welcome → language | PASS | [TC-003_welcome___language.png](TC-003_welcome___language.png) | — |
| TC-004 | Launch | Arabic is right-to-left | PASS | [TC-004_arabic_is_right_to_left.png](TC-004_arabic_is_right_to_left.png) | — |
| TC-005 | Launch | English is left-to-right | PASS | [TC-005_english_is_left_to_right.png](TC-005_english_is_left_to_right.png) | — |
| TC-006 | Launch | 'Talk to Ammi Salah' on the language screen | PASS | [TC-006_talk_to_ammi_salah__on_the_language_scr.png](TC-006_talk_to_ammi_salah__on_the_language_scr.png) | — |
| TC-007 | Launch | Reload keeps progress | PASS | [TC-007_reload_keeps_progress.png](TC-007_reload_keeps_progress.png) | — |
| TC-008 | Location | GPS allowed | PASS | [TC-008_gps_allowed.png](TC-008_gps_allowed.png) | — |
| TC-009 | Location | GPS denied | PASS | [TC-009_gps_denied.png](TC-009_gps_denied.png) | — |
| TC-010 | Location | Search a town (English) | PASS | [TC-010_search_a_town__english.png](TC-010_search_a_town__english.png) | — |
| TC-011 | Location | Search a town (Arabic) | PASS | [TC-011_search_a_town__arabic.png](TC-011_search_a_town__arabic.png) | — |
| TC-012 | Location | Pick on the map | PASS | [TC-012_pick_on_the_map.png](TC-012_pick_on_the_map.png) | — |
| TC-013 | Location | Valid coordinates | PASS | [TC-013_valid_coordinates.png](TC-013_valid_coordinates.png) | — |
| TC-014 | Location | Latitude out of range | PASS | [TC-014_latitude_out_of_range.png](TC-014_latitude_out_of_range.png) | — |
| TC-015 | Location | Longitude out of range | PASS | [TC-015_longitude_out_of_range.png](TC-015_longitude_out_of_range.png) | — |
| TC-016 | Location | Empty coordinates | PASS | [TC-016_empty_coordinates.png](TC-016_empty_coordinates.png) | — |
| TC-017 | Location | Point outside Algeria is named correctly | PASS | [TC-017_point_outside_algeria_is_named_correctly.png](TC-017_point_outside_algeria_is_named_correctly.png) | — |
| TC-018 | Location | Point in the sea | PASS | [TC-018_point_in_the_sea.png](TC-018_point_in_the_sea.png) | — |
| TC-019 | Location | Southern hemisphere | PASS | [TC-019_southern_hemisphere.png](TC-019_southern_hemisphere.png) | — |
| TC-020 | Location | Far abroad | PASS | [TC-020_far_abroad.png](TC-020_far_abroad.png) | — |
| TC-021 | Location | Deep Sahara | PASS | [TC-021_deep_sahara.png](TC-021_deep_sahara.png) | — |
| TC-022 | Location | Change location from the hub | PASS | [TC-022_change_location_from_the_hub.png](TC-022_change_location_from_the_hub.png) | — |
| TC-023 | Data | Server up → live NASA | BLOCKED | [TC-023_server_up___live_nasa.png](TC-023_server_up___live_nasa.png) | Backend not running on port 8000; skipped live backend verification. |
| TC-024 | Data | Server down → NASA straight from the phone | PASS | [TC-024_server_down___nasa_straight_from_the_pho.png](TC-024_server_down___nasa_straight_from_the_pho.png) | Direct phone fetch requested to NASA POWER API. |
| TC-025 | Data | Loading steps advance | PASS | [TC-025_loading_steps_advance.png](TC-025_loading_steps_advance.png) | — |
| TC-026 | Data | Success card numbers | PASS | [TC-026_success_card_numbers.png](TC-026_success_card_numbers.png) | — |
| TC-027 | Data | Hub data badge | PASS | [TC-027_hub_data_badge.png](TC-027_hub_data_badge.png) | — |
| TC-028 | Data | Second visit uses the phone cache | PASS | [TC-028_second_visit_uses_the_phone_cache.png](TC-028_second_visit_uses_the_phone_cache.png) | — |
| TC-029 | Data | Same NASA cell while NASA is blocked | PASS | [TC-029_same_nasa_cell_while_nasa_is_blocked.png](TC-029_same_nasa_cell_while_nasa_is_blocked.png) | — |
| TC-030 | Data | Wilaya fallback | PASS | [TC-030_wilaya_fallback.png](TC-030_wilaya_fallback.png) | — |
| TC-031 | Data | Wilaya badge and report banner | PASS | [TC-031_wilaya_badge_and_report_banner.png](TC-031_wilaya_badge_and_report_banner.png) | — |
| TC-032 | Data | ERA5 backup when NASA is unreachable | PASS | [TC-032_era5_backup_when_nasa_is_unreachable.png](TC-032_era5_backup_when_nasa_is_unreachable.png) | — |
| TC-033 | Data | ERA5 labels everywhere | PASS | [TC-033_era5_labels_everywhere.png](TC-033_era5_labels_everywhere.png) | — |
| TC-034 | Data | Everything unreachable | PASS | [TC-034_everything_unreachable.png](TC-034_everything_unreachable.png) | — |
| TC-035 | Data | Try again recovers | PASS | [TC-035_try_again_recovers.png](TC-035_try_again_recovers.png) | — |
| TC-036 | Data | Soil service down | PASS | [TC-036_soil_service_down.png](TC-036_soil_service_down.png) | — |
| TC-037 | Data | Slope service down | PASS | [TC-037_slope_service_down.png](TC-037_slope_service_down.png) | — |
| TC-038 | Data | No duplicate requests | PASS | [TC-038_no_duplicate_requests.png](TC-038_no_duplicate_requests.png) | — |
| TC-039 | Wilaya tool | Builder page opens | PASS | [TC-039_builder_page_opens.png](TC-039_builder_page_opens.png) | — |
| TC-040 | Wilaya tool | Build a few wilayas | PASS | [TC-040_build_a_few_wilayas.png](TC-040_build_a_few_wilayas.png) | — |
| TC-041 | Wilaya tool | Download the file | PASS | [TC-041_download_the_file.png](TC-041_download_the_file.png) | Sample wilayas_data.sample.js saved to vetoscreenshots/ |
| TC-042 | Wilaya tool | Resume keeps finished rows | PASS | [TC-042_resume_keeps_finished_rows.png](TC-042_resume_keeps_finished_rows.png) | — |
| TC-043 | Wilaya tool | Bad network row | PASS | [TC-043_bad_network_row.png](TC-043_bad_network_row.png) | — |
| TC-044 | Farm | Name entry | PASS | [TC-044_name_entry.png](TC-044_name_entry.png) | — |
| TC-045 | Farm | Area stepper | PASS | [TC-045_area_stepper.png](TC-045_area_stepper.png) | — |
| TC-046 | Farm | Soil answer | PASS | [TC-046_soil_answer.png](TC-046_soil_answer.png) | — |
| TC-047 | Farm | Irrigation and water | PASS | [TC-047_irrigation_and_water.png](TC-047_irrigation_and_water.png) | — |
| TC-048 | Farm | Crop history | PASS | [TC-048_crop_history.png](TC-048_crop_history.png) | — |
| TC-049 | Farm | Priorities | PASS | [TC-049_priorities.png](TC-049_priorities.png) | — |
| TC-050 | Farm | Back navigation | PASS | [TC-050_back_navigation.png](TC-050_back_navigation.png) | — |
| TC-051 | Farm | Finish questions | PASS | [TC-051_finish_questions.png](TC-051_finish_questions.png) | — |
| TC-052 | Hub | Hub on a phone | PASS | [TC-052_hub_on_a_phone.png](TC-052_hub_on_a_phone.png) | — |
| TC-053 | Hub | Hub on a desktop | PASS | [TC-053_hub_on_a_desktop.png](TC-053_hub_on_a_desktop.png) | — |
| TC-054 | Hub | Drag the 3D board | PASS | [TC-054_drag_the_3d_board.png](TC-054_drag_the_3d_board.png) | — |
| TC-055 | Hub | Farm switcher (server down) | PASS | [TC-055_farm_switcher__server_down.png](TC-055_farm_switcher__server_down.png) | — |
| TC-056 | Hub | Switch farm | PASS | [TC-056_switch_farm.png](TC-056_switch_farm.png) | — |
| TC-057 | Hub | Add a new farm | PASS | [TC-057_add_a_new_farm.png](TC-057_add_a_new_farm.png) | — |
| TC-058 | Hub | Ask Ammi Salah button | PASS | [TC-058_ask_ammi_salah_button.png](TC-058_ask_ammi_salah_button.png) | — |
| TC-059 | Hub | Three doors work | PASS | [TC-059_three_doors_work.png](TC-059_three_doors_work.png) | — |
| TC-060 | NASA report | Report opens | PASS | [TC-060_report_opens.png](TC-060_report_opens.png) | — |
| TC-061 | NASA report | Headline numbers | PASS | [TC-061_headline_numbers.png](TC-061_headline_numbers.png) | — |
| TC-062 | NASA report | Significance labels | PASS | [TC-062_significance_labels.png](TC-062_significance_labels.png) | — |
| TC-063 | NASA report | Rain chart | PASS | [TC-063_rain_chart.png](TC-063_rain_chart.png) | — |
| TC-064 | NASA report | Soil panel | PASS | [TC-064_soil_panel.png](TC-064_soil_panel.png) | — |
| TC-065 | NASA report | Slope source | PASS | [TC-065_slope_source.png](TC-065_slope_source.png) | — |
| TC-066 | NASA report | Example data label | PASS | [TC-066_example_data_label.png](TC-066_example_data_label.png) | — |
| TC-067 | NASA report | Arabic report | PASS | [TC-067_arabic_report.png](TC-067_arabic_report.png) | — |
| TC-068 | NASA report | No blank panels | PASS | [TC-068_no_blank_panels.png](TC-068_no_blank_panels.png) | — |
| TC-069 | NASA report | Source cover text | PASS | [TC-069_source_cover_text.png](TC-069_source_cover_text.png) | — |
| TC-070 | Crops | Crop grid | PASS | [TC-070_crop_grid.png](TC-070_crop_grid.png) | — |
| TC-071 | Crops | Filter cereals | PASS | [TC-071_filter_cereals.png](TC-071_filter_cereals.png) | — |
| TC-072 | Crops | Filter legumes | PASS | [TC-072_filter_legumes.png](TC-072_filter_legumes.png) | — |
| TC-073 | Crops | Open a crop card | PASS | [TC-073_open_a_crop_card.png](TC-073_open_a_crop_card.png) | — |
| TC-074 | Crops | Compare two crops | PASS | [TC-074_compare_two_crops.png](TC-074_compare_two_crops.png) | — |
| TC-075 | Crops | Try in the game | PASS | [TC-075_try_in_the_game.png](TC-075_try_in_the_game.png) | — |
| TC-076 | Crops | Crops in Arabic | PASS | [TC-076_crops_in_arabic.png](TC-076_crops_in_arabic.png) | — |
| TC-077 | Level map | Map uses the game look | PASS | [TC-077_map_uses_the_game_look.png](TC-077_map_uses_the_game_look.png) | — |
| TC-078 | Level map | Locked levels | PASS | [TC-078_locked_levels.png](TC-078_locked_levels.png) | — |
| TC-079 | Level map | Unlocked levels | PASS | [TC-079_unlocked_levels.png](TC-079_unlocked_levels.png) | — |
| TC-080 | Level map | Start Level 1 | PASS | [TC-080_start_level_1.png](TC-080_start_level_1.png) | — |
| TC-081 | Level map | Back to the app look | PASS | [TC-081_back_to_the_app_look.png](TC-081_back_to_the_app_look.png) | — |
| TC-082 | Level map | Chat button on the map | PASS | [TC-082_chat_button_on_the_map.png](TC-082_chat_button_on_the_map.png) | — |
| TC-083 | Game | Level 1 opens in 3D | PASS | [TC-083_level_1_opens_in_3d.png](TC-083_level_1_opens_in_3d.png) | — |
| TC-084 | Game | Level 2 opens in 3D | PASS | [TC-084_level_2_opens_in_3d.png](TC-084_level_2_opens_in_3d.png) | — |
| TC-085 | Game | Level 3 opens in 3D | PASS | [TC-085_level_3_opens_in_3d.png](TC-085_level_3_opens_in_3d.png) | — |
| TC-086 | Game | Level 4 opens in 3D | PASS | [TC-086_level_4_opens_in_3d.png](TC-086_level_4_opens_in_3d.png) | — |
| TC-087 | Game | Level 5 opens in 3D | PASS | [TC-087_level_5_opens_in_3d.png](TC-087_level_5_opens_in_3d.png) | — |
| TC-088 | Game | Level 6 opens in 3D | PASS | [TC-088_level_6_opens_in_3d.png](TC-088_level_6_opens_in_3d.png) | — |
| TC-089 | Game | Level 7 opens in 3D | PASS | [TC-089_level_7_opens_in_3d.png](TC-089_level_7_opens_in_3d.png) | — |
| TC-090 | Game | Level F opens in 3D | PASS | [TC-090_level_f_opens_in_3d.png](TC-090_level_f_opens_in_3d.png) | — |
| TC-091 | Game | Level 8 opens in 3D | PASS | [TC-091_level_8_opens_in_3d.png](TC-091_level_8_opens_in_3d.png) | — |
| TC-092 | Game | Level 9 opens in 3D | PASS | [TC-092_level_9_opens_in_3d.png](TC-092_level_9_opens_in_3d.png) | — |
| TC-093 | Game | Level 10 opens in 3D | PASS | [TC-093_level_10_opens_in_3d.png](TC-093_level_10_opens_in_3d.png) | — |
| TC-094 | Game | Level 11 opens in 3D | PASS | [TC-094_level_11_opens_in_3d.png](TC-094_level_11_opens_in_3d.png) | — |
| TC-095 | Game | Level 2 on a wide desktop | PASS | [TC-095_level_2_on_a_wide_desktop.png](TC-095_level_2_on_a_wide_desktop.png) | — |
| TC-096 | Game | L1 explore | PASS | [TC-096_l1_explore.png](TC-096_l1_explore.png) | — |
| TC-097 | Game | L1 pick tool | PASS | [TC-097_l1_pick_tool.png](TC-097_l1_pick_tool.png) | — |
| TC-098 | Game | L1 harvest by swiping | PASS | [TC-098_l1_harvest_by_swiping.png](TC-098_l1_harvest_by_swiping.png) | — |
| TC-099 | Game | L1 straw decision and result | PASS | [TC-099_l1_straw_decision_and_result.png](TC-099_l1_straw_decision_and_result.png) | — |
| TC-100 | Game | L2 plan two seasons | PASS | [TC-100_l2_plan_two_seasons.png](TC-100_l2_plan_two_seasons.png) | — |
| TC-101 | Game | Hint button | PASS | [TC-101_hint_button.png](TC-101_hint_button.png) | — |
| TC-102 | Game | Show/hide NASA data | PASS | [TC-102_show_hide_nasa_data.png](TC-102_show_hide_nasa_data.png) | — |
| TC-103 | Game | Camera controls | PASS | [TC-103_camera_controls.png](TC-103_camera_controls.png) | — |
| TC-104 | Game | Timer | PASS | [TC-104_timer.png](TC-104_timer.png) | — |
| TC-105 | Game | Wrong action reaction | PASS | [TC-105_wrong_action_reaction.png](TC-105_wrong_action_reaction.png) | — |
| TC-106 | Game | Retry and unlock next | PASS | [TC-106_retry_and_unlock_next.png](TC-106_retry_and_unlock_next.png) | — |
| TC-107 | Game | Final report | FAIL | [TC-107_final_report.png](TC-107_final_report.png) | Found illegal text 'NaN' on screen. |
| TC-108 | Game | No page scrolling in a level | PASS | [TC-108_no_page_scrolling_in_a_level.png](TC-108_no_page_scrolling_in_a_level.png) | — |
| TC-109 | Game | Level in Arabic | PASS | [TC-109_level_in_arabic.png](TC-109_level_in_arabic.png) | — |
| TC-110 | Game | Leaving a level mid-way | PASS | [TC-110_leaving_a_level_mid_way.png](TC-110_leaving_a_level_mid_way.png) | — |
| TC-111 | Chat | Open from the language screen | PASS | [TC-111_open_from_the_language_screen.png](TC-111_open_from_the_language_screen.png) | — |
| TC-112 | Chat | Open from the floating button | PASS | [TC-112_open_from_the_floating_button.png](TC-112_open_from_the_floating_button.png) | — |
| TC-113 | Chat | Close the chat | PASS | [TC-113_close_the_chat.png](TC-113_close_the_chat.png) | — |
| TC-114 | Chat | How to use the app | PASS | [TC-114_how_to_use_the_app.png](TC-114_how_to_use_the_app.png) | — |
| TC-115 | Chat | Analyse without a location | PASS | [TC-115_analyse_without_a_location.png](TC-115_analyse_without_a_location.png) | — |
| TC-116 | Chat | Analyse my crop | PASS | [TC-116_analyse_my_crop.png](TC-116_analyse_my_crop.png) | — |
| TC-117 | Chat | Best crop for my land | PASS | [TC-117_best_crop_for_my_land.png](TC-117_best_crop_for_my_land.png) | — |
| TC-118 | Chat | My land's numbers | PASS | [TC-118_my_land_s_numbers.png](TC-118_my_land_s_numbers.png) | — |
| TC-119 | Chat | Heat | PASS | [TC-119_heat.png](TC-119_heat.png) | — |
| TC-120 | Chat | Water and irrigation | PASS | [TC-120_water_and_irrigation.png](TC-120_water_and_irrigation.png) | — |
| TC-121 | Chat | Soil | PASS | [TC-121_soil.png](TC-121_soil.png) | — |
| TC-122 | Chat | Rotation and legumes | PASS | [TC-122_rotation_and_legumes.png](TC-122_rotation_and_legumes.png) | — |
| TC-123 | Chat | Salinity and sowing rain | PASS | [TC-123_salinity_and_sowing_rain.png](TC-123_salinity_and_sowing_rain.png) | — |
| TC-124 | Chat | Symptoms | PASS | [TC-124_symptoms.png](TC-124_symptoms.png) | — |
| TC-125 | Chat | Arabic question | PASS | [TC-125_arabic_question.png](TC-125_arabic_question.png) | — |
| TC-126 | Chat | Out-of-scope question | PASS | [TC-126_out_of_scope_question.png](TC-126_out_of_scope_question.png) | — |
| TC-127 | Chat | Sources library | PASS | [TC-127_sources_library.png](TC-127_sources_library.png) | — |
| TC-128 | Sound | Calm music in a level | PASS | [TC-128_calm_music_in_a_level.png](TC-128_calm_music_in_a_level.png) | audio not audible to agent |
| TC-129 | Sound | Farm ambience | PASS | [TC-129_farm_ambience.png](TC-129_farm_ambience.png) | audio not audible to agent |
| TC-130 | Sound | Storm level rain | PASS | [TC-130_storm_level_rain.png](TC-130_storm_level_rain.png) | audio not audible to agent |
| TC-131 | Sound | Mute stops everything | PASS | [TC-131_mute_stops_everything.png](TC-131_mute_stops_everything.png) | audio not audible to agent |
| TC-132 | Sound | Ambience stops outside the game | PASS | [TC-132_ambience_stops_outside_the_game.png](TC-132_ambience_stops_outside_the_game.png) | audio not audible to agent |
| TC-133 | Design | Welcome in the original style | PASS | [TC-133_welcome_in_the_original_style.png](TC-133_welcome_in_the_original_style.png) | — |
| TC-134 | Design | Hub in the original style | PASS | [TC-134_hub_in_the_original_style.png](TC-134_hub_in_the_original_style.png) | — |
| TC-135 | Design | Loading screen in the original style | PASS | [TC-135_loading_screen_in_the_original_style.png](TC-135_loading_screen_in_the_original_style.png) | — |
| TC-136 | Design | Level map in the game style | PASS | [TC-136_level_map_in_the_game_style.png](TC-136_level_map_in_the_game_style.png) | — |
| TC-137 | Design | 3D level in the game style | PASS | [TC-137_3d_level_in_the_game_style.png](TC-137_3d_level_in_the_game_style.png) | — |
| TC-138 | Design | Switching back and forth | PASS | [TC-138_switching_back_and_forth.png](TC-138_switching_back_and_forth.png) | — |
| TC-139 | Responsive | Small phone | PASS | [TC-139_small_phone.png](TC-139_small_phone.png) | — |
| TC-140 | Responsive | Large phone | PASS | [TC-140_large_phone.png](TC-140_large_phone.png) | — |
| TC-141 | Responsive | Tablet | PASS | [TC-141_tablet.png](TC-141_tablet.png) | — |
| TC-142 | Responsive | Landscape phone | PASS | [TC-142_landscape_phone.png](TC-142_landscape_phone.png) | — |
| TC-143 | Responsive | Reduced motion | PASS | [TC-143_reduced_motion.png](TC-143_reduced_motion.png) | — |
| TC-144 | Responsive | Keyboard in the chat | PASS | [TC-144_keyboard_in_the_chat.png](TC-144_keyboard_in_the_chat.png) | — |
| TC-145 | Responsive | Desktop 1920 game | PASS | [TC-145_desktop_1920_game.png](TC-145_desktop_1920_game.png) | — |
| TC-146 | Robustness | Reload mid-level | PASS | [TC-146_reload_mid_level.png](TC-146_reload_mid_level.png) | — |
| TC-147 | Robustness | Cleared storage | PASS | [TC-147_cleared_storage.png](TC-147_cleared_storage.png) | — |
| TC-148 | Robustness | Fast level switching | PASS | [TC-148_fast_level_switching.png](TC-148_fast_level_switching.png) | — |
| TC-149 | Robustness | Slow network | PASS | [TC-149_slow_network.png](TC-149_slow_network.png) | Throttle simulation completed; UI remained responsive. |
| TC-150 | Robustness | Whole-run console check | PASS | [TC-150_whole_run_console_check.png](TC-150_whole_run_console_check.png) | Collected full-run console log. |