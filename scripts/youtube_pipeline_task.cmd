@echo off
REM youtube_pipeline_task.cmd — Action goi tu Windows Task Scheduler (task
REM "YoutubeReupPipeline"). Chi lam 1 viec: set channel_id roi goi
REM youtube_pipeline_cycle.sh qua Git Bash. Sua channel_id o day neu doi channel.
set YOUTUBE_CHANNEL_ID=UCqWga83LRtNEmInHryVwbMw
"C:\Program Files\Git\bin\bash.exe" "D:\huyworking\claude-video-kit\scripts\youtube_pipeline_cycle.sh"
