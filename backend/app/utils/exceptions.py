class VideoProcessingError(Exception):
    """Raised when video processing fails"""
    pass


class VideoDownloadError(Exception):
    """Raised when video download fails"""
    pass


class InvalidVideoFormat(Exception):
    """Raised when video format is invalid"""
    pass


class FileSizeExceededError(Exception):
    """Raised when file size exceeds limit"""
    pass
